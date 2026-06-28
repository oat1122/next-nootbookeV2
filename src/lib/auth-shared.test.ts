import { describe, expect, it } from 'vitest';
import {
  AUTH_COOKIE_NAME,
  SHARED_AUTH_COOKIE_MAX_AGE_SECONDS,
  slidingAuthCookie,
} from './auth-shared';

/**
 * sliding session (docesacc/audit/03 R3): proxy ต่ออายุ shared cookie ทุกครั้งที่ user active
 * ล็อก wire-format ของ cookie ที่ proxy re-set ให้ตรงกับ cookie ที่ Laravel ออกตอน login
 * (HttpOnly + Secure + SameSite=Lax + Domain) ไม่งั้น cookie แชร์ข้าม subdomain เพี้ยน
 */
describe('slidingAuthCookie', () => {
  it('re-set ค่า token เดิมด้วยแอตทริบิวต์ครบ + secure ข้าม subdomain', () => {
    const c = slidingAuthCookie('123|plain-token');
    expect(c).toMatchObject({
      name: AUTH_COOKIE_NAME,
      value: '123|plain-token',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    // ต้องเป็น domain แบบมีจุดนำหน้าเท่านั้น cookie ถึงแชร์ข้าม subdomain ได้ (R2b)
    expect(c.domain.startsWith('.')).toBe(true);
  });

  it('อายุ = 30 วัน (ต้องตรงกับ Laravel SHARED_COOKIE_TTL_MINUTES)', () => {
    expect(SHARED_AUTH_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30);
    expect(slidingAuthCookie('t').maxAge).toBe(2_592_000);
  });
});
