import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  getRawLoginUrl,
  isDevAuthBypass,
  slidingAuthCookie,
} from '@/lib/auth-shared';

/**
 * Gate auth เบื้องต้นก่อนเข้าโซน (app) (ดู docesacc/02 §3, 04 §4)
 * (Next 16 เปลี่ยนชื่อ convention จาก middleware → proxy)
 * - ที่นี่แค่เช็คว่ามี cookie token ไหม ถ้าไม่มี → เด้งไป login กลาง (optimistic check)
 * - การตรวจ token จริง (ผ่าน Drizzle) ทำใน (app)/layout.tsx ด้วย requireUser()
 *   proxy ตั้งใจไว้ทำเช็คแบบเบา ๆ เท่านั้น ไม่ควรใช้เป็น session/authorization เต็มรูปแบบ
 * ⚠️ import ได้แค่ @/lib/auth-shared (raw process.env) — เก็บให้เบา ห้ามแตะ DB/t3-env
 */
export function proxy(req: NextRequest) {
  // devmode: ข้ามด่านทั้งหมด (กัน prod ด้วย NODE_ENV ใน isDevAuthBypass)
  if (isDevAuthBypass()) {
    return NextResponse.next();
  }
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    // F11: ใช้แหล่ง LOGIN_URL เดียวกับ server (ไม่ redirect ไป '/login' ที่จะ redirect ซ้ำอีกที)
    return NextResponse.redirect(new URL(getRawLoginUrl(), req.url));
  }
  // sliding session (docesacc/audit/03 R3): ต่ออายุ shared cookie ทุกครั้งที่ user active บน accountv2
  // → active อยู่ก็ไม่หลุด login (เดิม cookie ตายตัว 30 วันนับจาก login เท่านั้น). re-set ค่าเดิม + max-age ใหม่
  // • prod เท่านั้น: dev cookie เป็น host-only บน localhost (ตั้งโดย JS sharedAuthCookie) — อย่าทับด้วย domain
  //   .izasskobibe.com; dev ที่เปิด bypass ก็ return ไปแล้วด้านบน
  // • proxy ไม่ verify token (Edge, ไม่มี DB) — ถ้า token ตายจริง ชั้น app (requireUser) ปฏิเสธเองอยู่แล้ว
  //   การต่ออายุ cookie ที่ตายไม่ได้ให้สิทธิ์เพิ่ม (verify ยังตกอยู่ดี)
  const res = NextResponse.next();
  if (process.env.NODE_ENV === 'production') {
    res.cookies.set(slidingAuthCookie(token));
  }
  return res;
}

export const config = {
  // โซนที่ต้อง login — ใส่ route group (app) ไว้ใต้ /app (ยังไม่มีหน้า → matcher นี้ inert จนกว่าจะสร้าง)
  // เพิ่ม path ใหม่ของ notebook ตรงนี้เมื่อสร้างหน้าที่ต้องการ auth
  matcher: ['/app/:path*'],
};
