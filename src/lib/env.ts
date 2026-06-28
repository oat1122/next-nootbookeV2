import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';
import { DEFAULT_LOGIN_URL } from '@/lib/auth-shared';
import { isSharedCookieDomainValid } from '@/lib/env-validate';

/**
 * Type-safe / validated environment variables (ดู docesacc/01 §8, 03 §1)
 * ใช้ผ่าน `import { env } from '@/lib/env'` ในโค้ดฝั่ง server เท่านั้น
 * ข้าม validation ตอน build ได้ด้วย SKIP_ENV_VALIDATION=1
 */
export const env = createEnv({
  server: {
    // mysql://USER:PASSWORD@HOST:3307/DBNAME — ชี้ MariaDB ตัวเดิมของ TNP-FormHelpers
    DATABASE_URL: z.string().min(1),
    // cookie auth ที่แชร์ข้าม subdomain — R2b: prod ต้องเป็น domain แบบมีจุดนำหน้า (ดู env-validate.ts)
    SHARED_AUTH_COOKIE_DOMAIN: z
      .string()
      .min(1)
      .default('.izasskobibe.com')
      .refine((d) => isSharedCookieDomainValid(d, process.env.NODE_ENV === 'production'), {
        message:
          "บน production SHARED_AUTH_COOKIE_DOMAIN ต้องขึ้นต้นด้วย '.' (เช่น '.izasskobibe.com') ไม่งั้น cookie แชร์ข้าม subdomain ไม่ติด — ดู docesacc/audit/03 R2b",
      }),
    // หน้า login กลางของระบบเดิม (default ใช้ค่าเดียวกับ proxy ผ่าน DEFAULT_LOGIN_URL — F11)
    LOGIN_URL: z.string().url().default(DEFAULT_LOGIN_URL),
    // namespace ของ Sanctum tokenable (User model) — ยืนยันกับ DB จริงก่อน prod:
    //   SELECT DISTINCT tokenable_type FROM personal_access_tokens LIMIT 5;
    SANCTUM_TOKENABLE_TYPE: z.string().min(1).default('App\\Models\\User'),
    // F4: ability ที่ token ต้องมีถึงจะเข้าระบบบัญชีได้ ('*' = full-access ผ่านเสมอ) — default บังคับ '*'
    SANCTUM_REQUIRED_ABILITY: z.string().min(1).default('*'),
    // F3: อายุสูงสุดของ token (วัน) — ไม่ตั้ง = ไม่จำกัด (Sanctum ส่วนใหญ่ไม่มี expiry; ตกลงค่ากับทีม Laravel ก่อนเปิด)
    SANCTUM_MAX_TOKEN_AGE_DAYS: z.coerce.number().int().positive().optional(),
    // dev-only: ถ้าตั้งไว้ devmode จะโหลด user จริงจาก DB ตาม id นี้แทน mock (ดู src/server/auth/session.ts)
    DEV_USER_ID: z.string().optional(),
    // F6 dev-only: role ของ mock user ตอน bypass (default 'sale' — ตั้งใจไม่ให้ default เป็น admin)
    DEV_USER_ROLE: z.string().optional(),
    // dev-only: sub-role codes ของ mock user (คั่นด้วย comma เช่น "SUPPORT_SALES,HEAD_OFFLINE")
    // ไม่ตั้ง = ให้ครบทุก sub-role เพื่อเห็นเมนู notebook ครบตอน dev (ดู session.ts)
    DEV_USER_SUB_ROLES: z.string().optional(),
    TZ: z.string().default('Asia/Bangkok'),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    SHARED_AUTH_COOKIE_DOMAIN: process.env.SHARED_AUTH_COOKIE_DOMAIN,
    LOGIN_URL: process.env.LOGIN_URL,
    SANCTUM_TOKENABLE_TYPE: process.env.SANCTUM_TOKENABLE_TYPE,
    SANCTUM_REQUIRED_ABILITY: process.env.SANCTUM_REQUIRED_ABILITY,
    SANCTUM_MAX_TOKEN_AGE_DAYS: process.env.SANCTUM_MAX_TOKEN_AGE_DAYS,
    DEV_USER_ID: process.env.DEV_USER_ID,
    DEV_USER_ROLE: process.env.DEV_USER_ROLE,
    DEV_USER_SUB_ROLES: process.env.DEV_USER_SUB_ROLES,
    TZ: process.env.TZ,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
