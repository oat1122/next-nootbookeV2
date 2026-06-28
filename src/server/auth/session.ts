import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { AUTH_COOKIE_NAME, isDevAuthBypass } from '@/lib/auth-shared';
import { loadSessionUser, verifySanctumToken, type Role, type SessionUser } from './verify-token';

/**
 * mock user ตายตัวสำหรับ devmode (เมื่อ bypass แต่ไม่ตั้ง DEV_USER_ID) — ไม่แตะ DB
 * ดู docesacc/04, Decision #4 ใน plan
 *
 * F6 (fail-closed): role **ไม่ default เป็น admin** อีกต่อไป — ใช้ 'sale' (สิทธิ์ต่ำ) เป็นค่าเริ่มต้น
 * เพื่อให้ bypass ที่หลุดไป online ไม่ได้สิทธิ์สูงสุดฟรี. ถ้าต้องการทดสอบสิทธิ์ admin ให้ตั้ง
 * `DEV_USER_ROLE=admin` หรือ `DEV_USER_ID` ชี้ user จริงอย่างชัดเจน
 */
export const DEV_SESSION_USER: SessionUser = {
  userId: 0,
  userUuid: '00000000-0000-0000-0000-000000000000',
  username: 'dev',
  role: (env.DEV_USER_ROLE as Role) || 'sale',
  firstName: 'Dev',
  lastName: 'Bypass',
  nickname: 'dev',
  position: 'ผู้พัฒนา (bypass)',
};

let bypassWarned = false;
function warnBypassOnce() {
  if (bypassWarned) return;
  bypassWarned = true;
  console.warn(
    '[auth] ⚠️ AUTH_DEV_BYPASS เปิดอยู่ — ข้ามการตรวจ login ทั้งหมด (ใช้เฉพาะ dev เท่านั้น)',
  );
}

/**
 * คืน SessionUser สำหรับ devmode:
 * - ถ้าตั้ง DEV_USER_ID → โหลด user จริงจาก DB ตาม id นั้น (ได้ role/ชื่อจริง)
 * - ไม่งั้น (หรือหา user ไม่เจอ) → คืน mock DEV_SESSION_USER
 */
export async function getDevSessionUser(): Promise<SessionUser> {
  if (env.DEV_USER_ID) {
    const user = await loadSessionUser(Number(env.DEV_USER_ID));
    if (user) return user;
    console.warn(
      `[auth] DEV_USER_ID=${env.DEV_USER_ID} ไม่พบ user ที่ใช้งานได้ใน DB — ใช้ mock DEV_SESSION_USER แทน`,
    );
  }
  return DEV_SESSION_USER;
}

/**
 * ดึง user ปัจจุบันจาก cookie auth ที่แชร์กับระบบเดิม (เรียกใน Server Component / Server Action)
 * ห่อด้วย React cache() → dedupe ภายใน 1 request
 * devmode: ถ้า bypass เปิดอยู่ คืน user หลอก/จริงทันที ก่อนแตะ cookie/DB
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (isDevAuthBypass()) {
    warnBypassOnce();
    return getDevSessionUser();
  }
  const store = await cookies();
  const raw = store.get(AUTH_COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifySanctumToken(raw);
});

/** บังคับว่าต้อง login — ถ้าไม่มี user → เด้งไปหน้า login กลางของระบบเดิม */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(env.LOGIN_URL);
  return user;
}
