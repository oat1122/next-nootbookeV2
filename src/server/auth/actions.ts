'use server';
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { personalAccessTokens } from '@/server/db/schema';
import { env } from '@/lib/env';
import { AUTH_COOKIE_NAME } from '@/lib/auth-shared';
import { extractPlainToken, hashToken } from './verify-token';

/**
 * ออกจากระบบ (ดู docesacc/04 §6):
 * 1. revoke **เฉพาะ token ปัจจุบัน** ตรงใน DB ผ่าน Drizzle — **ไม่เรียก Laravel API** (v2 คุย MariaDB ตรง
 *    ตามสถาปัตยกรรม, ดู CLAUDE.md). ลบแถวที่ `token = sha256(plain)` ของ cookie นี้ = ออกจากระบบ
 *    **เฉพาะอุปกรณ์นี้** (N1, docesacc/audit/02): ตัด blast-radius เดิมที่ลบ token ทุกตัวของ user
 *    (= เตะออกทุกอุปกรณ์/ทุกแอป ซึ่งใหญ่เกินไปและเป็น CSRF-logout/DoS vector).
 *    best-effort — ถ้าลบไม่สำเร็จก็ยังลบ cookie ต่อ (ไม่ขวาง logout)
 * 2. ลบ cookie `authToken` (domain ที่แชร์)
 * 3. redirect ไปหน้า login กลาง
 *
 * ⚠️ **ข้อยกเว้นกฎ F1 (audit/01):** action นี้ตั้งใจ **ไม่ห่อ `authedAction()`/`requireUser()`**
 * เพราะ (ก) มันกระทำต่อ "cookie/token ของผู้เรียกเอง" เท่านั้น (ไม่มี cross-user) และ (ข) ต้อง
 * ทำงานได้แม้ session หมดอายุ/ถูกปิด — ไม่งั้น requireUser จะ redirect ก่อนเคลียร์ cookie ทำให้
 * cookie ค้าง. **mutation action อื่นทุกตัวยังต้องห่อ `authedAction()` ตามกฎเดิม** (ดู CLAUDE.md)
 */
export async function logoutAction() {
  const store = await cookies();
  const raw = store.get(AUTH_COOKIE_NAME)?.value;
  const plain = raw ? extractPlainToken(raw) : null;

  if (plain) {
    try {
      // ลบเฉพาะ token ของ cookie นี้ (by hash, unique index) — อุปกรณ์อื่นยัง login อยู่
      await db.delete(personalAccessTokens).where(eq(personalAccessTokens.token, hashToken(plain)));
    } catch {
      // best-effort — revoke ล้มเหลวก็ยังลบ cookie ฝั่ง v2 ต่อไป
    }
  }

  store.set(AUTH_COOKIE_NAME, '', {
    domain: env.SHARED_AUTH_COOKIE_DOMAIN,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  redirect(env.LOGIN_URL);
}
