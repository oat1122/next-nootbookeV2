import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit CLI ไม่โหลด .env เอง(ต่างจาก Next.js) — โหลดให้ DATABASE_URL พร้อมใช้
// .env.local ก่อน (dev, ชนะตาม convention ของ Next) แล้ว .env (prod ใช้ไฟล์เดียว)
// dotenv ไม่ override ค่าที่ตั้งไว้แล้ว → ไฟล์แรกที่ set ชนะ + CI/prod ส่งผ่าน process.env จริงได้
config({ path: '.env.local' });
config({ path: '.env' });

/**
 * ใช้ "เฉพาะ introspect / ตรวจสอบ schema" เท่านั้น (ดู docesacc/03 §2)
 * ⚠️ ห้าม `drizzle-kit push` / `migrate` — DB เป็นของ Laravel/NestJS ร่วมกัน
 *   npm run db:introspect   # อ่าน schema จาก DB จริง
 *   npm run db:studio       # เปิด Drizzle Studio ดูข้อมูล
 */
export default defineConfig({
  dialect: 'mysql',
  schema: './src/server/db/schema/*.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
