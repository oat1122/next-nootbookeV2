import 'server-only';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { personalAccessTokens, users } from '@/server/db/schema';
import { env } from '@/lib/env';

/** role ของ user (จาก enum `users.role` ในระบบเดิม) */
export type Role = (typeof users.$inferSelect)['role'];

/**
 * ข้อมูล user ที่ปลอดภัยพอจะส่งออกจากชั้น auth — ตัด password/newPass ทิ้งโดยตั้งใจ
 * ใช้แทน user row ดิบทุกที่ในแอป (ดู docesacc/04 §5)
 */
export type SessionUser = {
  userId: number;
  userUuid: string;
  username: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  position: string | null;
};

/** sha256(plaintext) แบบ hex — Sanctum เก็บค่านี้ในคอลัมน์ `personal_access_tokens.token` */
export function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

/**
 * แยก plain token จากรูปแบบ Sanctum "{id}|{plain}" (F8: เอา "ทุกอย่างหลัง '|' ตัวแรก" เพราะ
 * plain เองอาจมี '|' ได้ — ไม่ใช่ split('|')[1] ที่หยิบแค่ segment ที่สอง). คืน null ถ้า plain ว่าง
 * ใช้ร่วมกันทั้ง verifySanctumToken และ logoutAction
 */
export function extractPlainToken(rawToken: string): string | null {
  const sep = rawToken.indexOf('|');
  const plain = sep === -1 ? rawToken : rawToken.slice(sep + 1);
  return plain || null;
}

/**
 * audit logging แบบ throttle ของการปฏิเสธ token (F9, docesacc/audit/01)
 * - log เฉพาะ "เหตุผลแบบหยาบ" เท่านั้น — **ไม่เคย log ตัว token หรือ hash** (กันข้อมูลลับหลุดใน log)
 * - throttle ต่อเหตุผล (กัน log ท่วมตอนโดน brute-force) แต่ยังเห็นสัญญาณพอจะตั้ง alert
 */
const AUTH_LOG_THROTTLE_MS = 60_000;
const lastAuthLogAt = new Map<string, number>();
function logAuthFailure(reason: string): void {
  const now = Date.now();
  if (now - (lastAuthLogAt.get(reason) ?? 0) < AUTH_LOG_THROTTLE_MS) return;
  lastAuthLogAt.set(reason, now);
  console.warn(`[auth] ปฏิเสธ token (${reason})`);
}

/**
 * โหลด user จาก DB ด้วย columns จำกัด + เช็คว่าใช้งานได้ แล้ว map เป็น SessionUser
 * (ใช้ร่วมกันทั้ง verifySanctumToken และ devmode `getDevSessionUser`)
 * คืน null ถ้าไม่พบ user หรือ user ถูกปิด/ลบ
 */
export async function loadSessionUser(userId: number): Promise<SessionUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.userId, userId),
    columns: {
      userId: true,
      userUuid: true,
      username: true,
      role: true,
      userFirstname: true,
      userLastname: true,
      userNickname: true,
      userPosition: true,
      userIsEnable: true,
      userIsDeleted: true,
    },
  });
  if (!user) return null;
  if (!user.userIsEnable || user.userIsDeleted) return null;

  return {
    userId: user.userId,
    userUuid: user.userUuid,
    username: user.username,
    role: user.role,
    firstName: user.userFirstname ?? null,
    lastName: user.userLastname ?? null,
    nickname: user.userNickname ?? null,
    position: user.userPosition ?? null,
  };
}

/**
 * ตรวจ Laravel Sanctum personal access token เองผ่าน Drizzle (ดู docesacc/04 §2)
 * รูปแบบ token จาก client: "<id>|<plainText>" ; Sanctum เก็บ sha256(plainText) ใน DB
 * (คอลัมน์ `token` มี unique index → ค้นด้วย hash อย่างเดียวระบุแถวได้แน่นอน)
 * คืน SessionUser ถ้า valid, ไม่งั้น null
 */
export async function verifySanctumToken(rawToken: string): Promise<SessionUser | null> {
  // F8: แยก plain จาก "{id}|{plain}" (รองรับ plain ที่มี '|' ในตัว) — ดู extractPlainToken
  const plain = extractPlainToken(rawToken);
  if (!plain) return null;

  const token = await db.query.personalAccessTokens.findFirst({
    where: eq(personalAccessTokens.token, hashToken(plain)),
  });
  if (!token) {
    logAuthFailure('not-found');
    return null;
  }
  // ยืนยันว่า token ผูกกับ User model จริง (ค่า namespace ปรับได้ผ่าน env — ยืนยันกับ DB จริงก่อน prod)
  if (token.tokenableType !== env.SANCTUM_TOKENABLE_TYPE) {
    logAuthFailure('type-mismatch');
    return null;
  }
  // เช็คหมดอายุเฉพาะเมื่อมีค่า (Sanctum legacy ปกติไม่ตั้ง expiry)
  if (token.expiresAt && token.expiresAt.getTime() < Date.now()) {
    logAuthFailure('expired');
    return null;
  }
  // F4: เคารพ Sanctum abilities (scope) — default ต้องมี '*' (full access) ไม่งั้นปฏิเสธ (fail-closed)
  //     ตั้ง SANCTUM_REQUIRED_ABILITY เพื่อยอมรับ ability เฉพาะทางเพิ่มได้ ('*' ผ่านเสมอ)
  if (!hasRequiredAbility(token.abilities)) {
    logAuthFailure('ability-missing');
    return null;
  }
  // F3: policy อายุสูงสุดฝั่ง v2 — บังคับเฉพาะเมื่อตั้ง SANCTUM_MAX_TOKEN_AGE_DAYS (default = ไม่จำกัด)
  //     กัน token ที่ "ไม่มีวันหมดอายุ" อยู่ยาวเกินไป (createdAt null = ไม่ตัดสิน เพื่อ fail-open ฝั่ง availability)
  const maxAgeDays = env.SANCTUM_MAX_TOKEN_AGE_DAYS;
  if (
    maxAgeDays &&
    token.createdAt &&
    Date.now() - token.createdAt.getTime() > maxAgeDays * 86_400_000
  ) {
    logAuthFailure('max-age');
    return null;
  }

  const user = await loadSessionUser(token.tokenableId);
  if (!user) logAuthFailure('user-unavailable');
  return user;
}

/**
 * true ถ้า token มีสิทธิ์พอจะเข้าระบบบัญชี (F4)
 * - มี '*' (Sanctum full-access ปกติ) → ผ่านเสมอ
 * - หรือมี ability ที่ระบุใน SANCTUM_REQUIRED_ABILITY
 * - parse ไม่ได้ / ไม่มี abilities → ปฏิเสธ (fail-closed)
 */
function hasRequiredAbility(rawAbilities: string | null): boolean {
  const required = env.SANCTUM_REQUIRED_ABILITY || '*';
  let abilities: unknown;
  try {
    abilities = rawAbilities ? JSON.parse(rawAbilities) : [];
  } catch {
    return false;
  }
  if (!Array.isArray(abilities)) return false;
  return abilities.includes('*') || abilities.includes(required);
}
