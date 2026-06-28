import 'server-only';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { env } from '@/lib/env';
import * as schema from './schema';

/**
 * Drizzle client ต่อ MariaDB ตัวเดิม (ดู docesacc/03 §1)
 * - decimalNumbers:false → อ่านเงิน decimal(15,2) เป็น string เพื่อคำนวณด้วย decimal.js
 * - timezone '+07:00' → เขียน datetime ให้ตรงกับ Laravel (Asia/Bangkok)
 * ⚠️ ห้าม push/migrate — DB เป็นของ Laravel/NestJS ร่วมกัน ใช้ drizzle-kit แค่ introspect
 */
function createPool() {
  const pool = mysql.createPool({
    uri: env.DATABASE_URL,
    decimalNumbers: false,
    // DATE (เช่น nb_date) อ่านเป็น string 'YYYY-MM-DD' ตรง ๆ — เลี่ยง TZ drift จากการ new Date()
    // DATETIME/TIMESTAMP ยังคืนเป็น Date object ( logic เช็ค token expiry พึ่งพา)
    dateStrings: ['DATE'],
    timezone: '+07:00',
    connectionLimit: 10,
  });

  // N2 (docesacc/audit/02): pin session time_zone ให้ตรงกับ mysql2 `timezone:'+07:00'` เสมอ
  // — ไม่งั้น session.time_zone='SYSTEM' จะอิง OS tz ของเครื่อง DB (เช่น prod บน UTC) ทำให้ driver
  //   ตีความ TIMESTAMP (expires_at/created_at/money dates) ผิด instant → เช็คหมดอายุอาจ fail-open.
  //   SET เป็น session-level เท่านั้น ไม่กระทบ Laravel/NestJS ที่ใช้ DB ร่วม
  pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+07:00'");
  });

  return pool;
}

// ใน dev, HMR จะ re-evaluate โมดูลนี้ทุกครั้งที่เซฟไฟล์ → ถ้าสร้าง pool ใหม่ทุกรอบ connection
// เก่าจะค้างจนชน max_connections ของ MariaDB (errno 1040 "Too many connections" — DB ใช้ร่วมกับ
// Laravel/NestJS). cache pool ไว้บน globalThis ให้ HMR ใช้ pool เดิมซ้ำ. prod โหลดครั้งเดียวอยู่แล้ว
const globalForDb = globalThis as unknown as { __pool?: mysql.Pool };
const pool = globalForDb.__pool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalForDb.__pool = pool;

export const db = drizzle(pool, { schema, mode: 'default' });
