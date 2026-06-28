/**
 * ตัวช่วย validate ค่า env แบบ pure (ไม่มี side-effect, ไม่อ่าน process.env เอง)
 * แยกออกจาก `env.ts` เพื่อให้ unit-test ได้โดยไม่ต้องไป trigger createEnv ทั้งก้อน
 */

/**
 * R2b (docesacc/audit/03): cookie `authToken` แชร์ข้าม subdomain ได้ก็ต่อเมื่อ domain
 * ขึ้นต้นด้วย '.' (เช่น `.izasskobibe.com`) — ถ้า prod เผลอตั้งเป็น host เดี่ยว
 * (`accountv2.izasskobibe.com` / `izasskobibe.com` ไม่มีจุดนำหน้า) cookie จะผูกกับ host เดียว
 * → ลบ cookie ตอน logout ไม่ออก/แชร์ไม่ติด แบบเงียบ ๆ. บังคับเฉพาะ prod (dev ใช้ `localhost` ได้)
 */
export function isSharedCookieDomainValid(domain: string, isProd: boolean): boolean {
  if (!isProd) return true; // dev: ปล่อยอิสระ (เช่น 'localhost') — guard ไว้กัน "deploy แล้วใช้ไม่ได้"
  return domain.startsWith('.');
}
