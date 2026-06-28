import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TZ = 'Asia/Bangkok';

/**
 * จัดรูปแบบ "ค่าจากคอลัมน์วันที่ของ DB" เป็นเวลาไทย (ดู docesacc/01 §8)
 *
 * ⚠️ ต้องใช้ `dayjs.utc()` ไม่ใช่ `.tz(TZ)` — เหตุผลที่ไม่ชัดเจน:
 * Drizzle map คอลัมน์ timestamp/datetime/date โดย "ติดป้าย" เป็น UTC เสมอ
 * (เช่น MySqlTimestamp.mapFromDriverValue = `new Date(value + '+0000')`) แต่ pool ของเรา
 * ตั้ง session `time_zone='+07:00'` + mysql2 `timezone:'+07:00'` (client.ts N2) ทำให้ DB
 * คืนค่าเป็น "เวลาไทย" (wall-clock) อยู่แล้ว → Date ที่ได้จึงมีเวลาไทยฝังอยู่ในช่อง UTC
 * ของมัน. ถ้าเผลอ `.tz(TZ)` จะบวก +7 ซ้ำ → เวลาเพี้ยน/ข้ามวัน (22:10 กลายเป็น 05:10).
 * อ่านช่อง UTC ออกมาตรง ๆ ด้วย utc() จึงได้เวลาไทยที่บันทึกจริง.
 *
 * (ใช้กับค่าที่มาจาก DB เท่านั้น — instant จริง เช่น `new Date()` ให้ใช้ bangkokYearMonth/`.tz`)
 */
export function formatDate(value: dayjs.ConfigType, fmt = 'DD/MM/YYYY'): string {
  return dayjs.utc(value).format(fmt);
}

/**
 * ปี/เดือน (เลขเดือน 1–12) ตามเวลาไทย — ใช้สำหรับออกเลขเอกสารที่รีเซ็ตรายเดือน (docesacc/05)
 *
 * รับ "instant จริง" (ค่า default = `new Date()`) จึงต้องแปลงด้วย `.tz(TZ)` ตามปกติ
 * — ต่างจาก formatDate ที่รับค่าจากคอลัมน์ DB (ดูคอมเมนต์ด้านบน)
 */
export function bangkokYearMonth(value: dayjs.ConfigType): { year: number; month: number } {
  const d = dayjs(value).tz(TZ);
  return { year: d.year(), month: d.month() + 1 };
}

const baht = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** จัดรูปแบบเงินบาท (รับ string จาก decimal column ได้ตรงๆ) */
export function formatBaht(value: number | string): string {
  return baht.format(typeof value === 'string' ? Number(value) : value);
}

/** date column (Date | 'YYYY-MM-DD' | null) → ค่าใส่ <input type="date"> ('YYYY-MM-DD'; ว่าง → '') */
export function toDateInput(v: Date | string | null | undefined): string {
  if (!v) return '';
  return (typeof v === 'string' ? v : v.toISOString()).slice(0, 10);
}

/** 'YYYY-MM-DD' → Date (เที่ยงคืน local) | undefined — react-day-picker ใน DatePicker ใช้ Date */
export function ymdToDate(v: string): Date | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

/** Date → 'YYYY-MM-DD' (อ่านส่วนวันแบบ local ไม่ใช้ toISOString — กันเพี้ยนข้ามวันจาก timezone) */
export function dateToYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** วันนี้ตามเวลาไทย เป็น 'YYYY-MM-DD' (en-CA = รูปแบบ ISO) — ค่าตั้งต้นของ "วันออกเอกสาร" */
export function todayBangkok(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}
