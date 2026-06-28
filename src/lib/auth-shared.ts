/**
 * โมดูล auth ที่ใช้ร่วมกันได้ทั้งฝั่ง proxy (proxy.ts) และฝั่ง Node server
 * (ดู docesacc/04). ⚠️ เก็บให้เบา — อ่าน raw `process.env` ตรง ๆ เท่านั้น:
 * ห้าม import DB/mysql2/t3-env/server-only เพราะ proxy ควรทำงานแบบเบา ๆ
 */

/**
 * ชื่อ cookie ที่แชร์ token ข้าม subdomain (.izasskobibe.com)
 * **ปักหมุด ไม่อ่านจาก env โดยตั้งใจ:** legacy Sanctum (`sharedAuthCookie.js` + `AuthController`)
 * ฮาร์ดโค้ดชื่อ `authToken` เสมอ → ค่านี้เปลี่ยนไม่ได้จริงถ้ายังแชร์ auth กับ legacy. การทำให้
 * override ผ่าน env ได้คือ footgun: prod ที่เผลอตั้งเพี้ยน → proxy/getCurrentUser อ่าน cookie
 * ไม่เจอ → ทุกคนโดนเด้ง login เงียบ ๆ (บั๊กคลาสเดียวกับ R2b/SHARED_AUTH_COOKIE_DOMAIN ที่หลุด
 * build guard เพราะ proxy เป็น edge-safe อ่าน raw env ไม่ผ่าน t3-env). ดู docesacc/audit/03
 */
export const AUTH_COOKIE_NAME = 'authToken';

/**
 * domain ของ shared cookie ฝั่ง proxy (raw env — ค่า/ดีฟอลต์เดียวกับ `env.SHARED_AUTH_COOKIE_DOMAIN`)
 * proxy (Edge) ใช้ t3-env ไม่ได้จึงอ่าน raw; prod ที่ตั้งเพี้ยนถูกกันด้วย build-guard R2b ฝั่ง env แล้ว
 */
export const SHARED_AUTH_COOKIE_DOMAIN = process.env.SHARED_AUTH_COOKIE_DOMAIN ?? '.izasskobibe.com';

/**
 * sliding session (docesacc/audit/03 R3): อายุ shared cookie = 30 วัน (วินาที)
 * ⚠️ ต้องตรงกับ Laravel `AuthController::SHARED_COOKIE_TTL_MINUTES` (30 วัน) — ต่ออายุที่ฝั่งไหนค่าก็เท่ากัน
 */
export const SHARED_AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * แอตทริบิวต์ cookie สำหรับ "ต่ออายุ" shared authToken ฝั่ง accountv2 (sliding session, R3)
 * ตรงกับ cookie ที่ Laravel ออกตอน login (HttpOnly + Secure + SameSite=Lax + Domain) — re-set ค่าเดิม
 * + max-age ใหม่เท่านั้น (ไม่สร้าง token ใหม่). แยกเป็น pure function เพื่อ unit-test โดยไม่พึ่ง Edge runtime
 */
export function slidingAuthCookie(token: string) {
  return {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    domain: SHARED_AUTH_COOKIE_DOMAIN,
    path: '/',
    maxAge: SHARED_AUTH_COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * ปลายทาง login กลางของระบบเดิม (default เดียวกับ `env.LOGIN_URL`)
 * แยกมาไว้ที่นี่เพื่อให้ proxy (Edge, ใช้ t3-env ไม่ได้) และ server ใช้ค่า/แหล่งเดียวกัน (F11)
 */
export const DEFAULT_LOGIN_URL = 'https://tnp.izasskobibe.com/login';

/** ค่า LOGIN_URL แบบ raw สำหรับฝั่ง proxy — กัน double-hop ไป '/login' ที่ redirect ซ้ำ (F11) */
export function getRawLoginUrl(): string {
  return process.env.LOGIN_URL || DEFAULT_LOGIN_URL;
}

/**
 * dev-only: ข้ามการเช็ค login ทั้งหมด (ทั้ง proxy และ getCurrentUser)
 * เพื่อพัฒนาโซน (app) โดยไม่ต้องมี cookie/DB จริง
 *
 * F6 (fail-closed): ทำงานเฉพาะ `NODE_ENV === 'development'` (คือ `next dev` เท่านั้น) —
 * เข้มกว่าเดิมที่ใช้ `!== 'production'` ซึ่งเผลอเปิดบน staging/`next start` ที่ลืมตั้ง NODE_ENV ได้.
 * แอปที่ build แล้ว (`next build && next start`) NODE_ENV=production → bypass ปิดเสมอ.
 * ดูเพิ่ม: build-time assert ใน next.config.ts + dev mock role ที่ไม่ default เป็น admin
 */
export function isDevAuthBypass(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.AUTH_DEV_BYPASS === '1';
}
