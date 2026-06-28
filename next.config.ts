import type { NextConfig } from 'next';

// กัน dev-bypass หลุดขึ้น production — build/boot จะ throw ถ้าเผลอติด flag มา
// (isDevAuthBypass ปิดตัวเองบน production อยู่แล้ว นี่คือด่านสองแบบ fail-loud ตอน build/start)
if (process.env.NODE_ENV === 'production' && process.env.AUTH_DEV_BYPASS === '1') {
  throw new Error(
    '[security] ห้ามตั้ง AUTH_DEV_BYPASS=1 บน production — ถอด env นี้ก่อน build/deploy',
  );
}

const isDev = process.env.NODE_ENV !== 'production';

// origin ที่อนุญาตให้เรียก Server Action (กัน CSRF). ตั้งผ่าน env แบบ comma-separated
// เช่น SERVER_ACTIONS_ALLOWED_ORIGINS="notebook.izasskobibe.com" เมื่อ deploy หลัง reverse proxy
// ไม่ตั้ง = same-origin เท่านั้น (default ปลอดภัยของ Next)
const envActionOrigins =
  process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean) ?? [];

// dev เท่านั้น: ให้ user ทดลองใช้โปรเจคผ่าน Cloudflare quick tunnel
//   npm run dev  +  cloudflared tunnel --url http://localhost:3000
// quick tunnel แจก subdomain *.trycloudflare.com แบบสุ่มใหม่ทุกครั้ง → ใช้ wildcard ครอบไว้
const tunnelOrigins = isDev ? ['*.trycloudflare.com'] : [];

// หลัง reverse proxy ถ้าไม่ตั้ง SERVER_ACTIONS_ALLOWED_ORIGINS → Next ปฏิเสธทุก Server Action
// ด้วย origin-check แบบ "เงียบ ๆ" (อ่านเพจได้ แต่กดอะไรไม่ได้). เตือนดัง ๆ ตอน build/boot ของ prod
if (!isDev && envActionOrigins.length === 0) {
  console.warn(
    '[deploy] ⚠️ ไม่ได้ตั้ง SERVER_ACTIONS_ALLOWED_ORIGINS — ถ้าเสิร์ฟหลัง reverse proxy ทุก Server Action (mutation) จะถูกปฏิเสธด้วย origin-check',
  );
}

const serverActionOrigins = [...envActionOrigins, ...tunnelOrigins];

// security headers ลด blast radius (กัน clickjacking/MIME-sniff, คุม referrer/permissions)
// CSP ใช้แค่ frame-ancestors 'none' — directive ที่กัน iframe ได้โดยไม่ทำหน้าเพจ/สคริปต์พัง
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  // serve ผ่าน custom server (server.ts) เป็น production entry → ไม่ใช้ output:'standalone'
  // (Next 16: custom server + standalone ใช้ร่วมกันไม่ได้). mysql2/@react-pdf รันบน Node ผ่าน
  // serverExternalPackages ด้านล่าง
  allowedDevOrigins: tunnelOrigins,
  // อย่า bundle แพ็กเกจฝั่ง server เหล่านี้ (ต้องรันบน Node runtime ไม่ใช่ Edge)
  serverExternalPackages: ['mysql2', '@react-pdf/renderer'],
  // เผื่อแนบไฟล์ผ่าน Server Action (FormData) — default ของ Next คือ 1 MB
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

// เพิ่ม allowedOrigins เฉพาะเมื่อมี origin (env หรือ dev tunnel) — ไม่งั้นคง default same-origin ไว้
if (serverActionOrigins.length) {
  nextConfig.experimental!.serverActions!.allowedOrigins = serverActionOrigins;
}

export default nextConfig;
