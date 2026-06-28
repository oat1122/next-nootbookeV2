import { describe, expect, it } from 'vitest';
import { isSharedCookieDomainValid } from './env-validate';

// R2b (docesacc/audit/03): กัน "deploy แล้ว cookie ไม่ติด" จาก SHARED_AUTH_COOKIE_DOMAIN ที่ตั้งผิด
describe('isSharedCookieDomainValid', () => {
  it('prod: domain มีจุดนำหน้า → ผ่าน', () => {
    expect(isSharedCookieDomainValid('.izasskobibe.com', true)).toBe(true);
  });

  it('prod: host เดี่ยว (ไม่มีจุดนำหน้า) → ปฏิเสธ', () => {
    expect(isSharedCookieDomainValid('accountv2.izasskobibe.com', true)).toBe(false);
    expect(isSharedCookieDomainValid('izasskobibe.com', true)).toBe(false);
  });

  it('dev: ปล่อยอิสระ (เช่น localhost)', () => {
    expect(isSharedCookieDomainValid('localhost', false)).toBe(true);
    expect(isSharedCookieDomainValid('accountv2.izasskobibe.com', false)).toBe(true);
  });
});
