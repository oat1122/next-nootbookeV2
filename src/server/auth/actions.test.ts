import { beforeEach, describe, expect, it, vi } from 'vitest';

// server-only เป็น no-op ในชั้นทดสอบ
vi.mock('server-only', () => ({}));

// คุม cookie store (next/headers) + redirect (next/navigation) + env + db client — ไม่แตะของจริง
const cookieStore = { get: vi.fn(), set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(cookieStore) }));

// next/navigation.redirect() ใน Next จะ throw เพื่อตัดจบ flow — จำลองด้วย sentinel
class RedirectSignal extends Error {
  constructor(public url: string) {
    super('NEXT_REDIRECT');
  }
}
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    SHARED_AUTH_COOKIE_DOMAIN: '.izasskobibe.com',
    LOGIN_URL: 'https://tnp.izasskobibe.com/login',
    SANCTUM_TOKENABLE_TYPE: 'App\\Models\\User',
    SANCTUM_REQUIRED_ABILITY: '*',
  },
}));

const whereMock = vi.fn().mockResolvedValue(undefined);
const deleteMock = vi.fn((..._args: unknown[]) => ({ where: whereMock }));
vi.mock('@/server/db/client', () => ({
  db: { delete: (...a: unknown[]) => deleteMock(...a) },
}));

import { eq } from 'drizzle-orm';
import { logoutAction } from './actions';
import { personalAccessTokens } from '@/server/db/schema';
import { hashToken } from './verify-token';

const PLAIN = 'legacy-plain-token';

beforeEach(() => {
  vi.clearAllMocks();
  whereMock.mockResolvedValue(undefined);
});

describe('logoutAction', () => {
  // N1 (docesacc/audit/02): revoke เฉพาะ token ปัจจุบัน (by hash) — ตัด blast-radius เดิม (ลบทุก token ของ user)
  it('N1: ลบเฉพาะ token ของ cookie นี้ (by hash) + เคลียร์ cookie + redirect', async () => {
    cookieStore.get.mockReturnValue({ value: `9|${PLAIN}` });

    await expect(logoutAction()).rejects.toBeInstanceOf(RedirectSignal);

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith(personalAccessTokens);
    // where = token === sha256(plain) → "อุปกรณ์นี้" เท่านั้น (ไม่ใช่ tokenableId = ทุกอุปกรณ์)
    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(whereMock).toHaveBeenCalledWith(eq(personalAccessTokens.token, hashToken(PLAIN)));
    // H5 (docesacc/audit/03): การลบ cookie ต้องตรง wire-format (name/domain/path/maxAge) กับ HttpOnly
    // cookie ที่ legacy ตั้งจาก server ไม่งั้นเบราว์เซอร์ไม่ลบให้ → logout แล้วยัง "ล็อกอินอยู่" บน v2.
    // ล็อกชื่อ 'authToken' (ปักหมุด ไม่ใช่ env) + domain '.izasskobibe.com' (R2b มีจุดนำหน้า) + maxAge 0
    expect(cookieStore.set).toHaveBeenCalledWith(
      'authToken',
      '',
      expect.objectContaining({ domain: '.izasskobibe.com', path: '/', maxAge: 0 }),
    );
  });

  // ข้อยกเว้นกฎ F1 ที่ตั้งใจ: logout ต้องทำงานแม้ session หมดอายุ → ไม่ห่อ requireUser
  it('ไม่มี cookie (session หมด/ไม่ได้ login) → ไม่ลบ DB แต่ยังเคลียร์ cookie + redirect', async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(logoutAction()).rejects.toBeInstanceOf(RedirectSignal);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(cookieStore.set).toHaveBeenCalled();
  });

  it('plain ว่าง ("9|") → ไม่ query ลบด้วย hash ของค่าว่าง', async () => {
    cookieStore.get.mockReturnValue({ value: '9|' });
    await expect(logoutAction()).rejects.toBeInstanceOf(RedirectSignal);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('revoke ล้มเหลว (DB error) → best-effort: ยังเคลียร์ cookie + redirect ต่อ', async () => {
    cookieStore.get.mockReturnValue({ value: `9|${PLAIN}` });
    whereMock.mockRejectedValue(new Error('db down'));
    await expect(logoutAction()).rejects.toBeInstanceOf(RedirectSignal);
    expect(cookieStore.set).toHaveBeenCalled();
  });
});
