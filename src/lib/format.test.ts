import { describe, expect, it } from 'vitest';
import { bangkokYearMonth, dateToYmd, formatBaht, formatDate, ymdToDate } from './format';

/**
 * คุมการแสดงเวลา: Drizzle ส่งค่าจากคอลัมน์ timestamp/datetime มาเป็น Date ที่ "ติดป้าย UTC"
 * แต่เนื้อในเป็นเวลาไทย (เพราะ session DB = +07:00) → formatDate ต้องอ่านช่อง UTC ตรง ๆ
 * ห้ามบวก +7 ซ้ำ (บั๊กเดิม: 22:10 น. แสดงเป็น 05:10 น. ของวันถัดไป)
 */
describe('formatDate (ค่าจากคอลัมน์ DB ผ่าน Drizzle)', () => {
  // จำลองสิ่งที่ Drizzle MySqlTimestamp.mapFromDriverValue คืนมา: new Date(value + '+0000')
  // โดย value = เวลาไทย wall-clock ที่ DB (session +07:00) ส่งกลับ
  const fromTimestampColumn = (bangkokWallClock: string) => new Date(`${bangkokWallClock}+0000`);

  it('แสดงเวลาตรงกับที่บันทึก ไม่บวก +7 ซ้ำ', () => {
    const v = fromTimestampColumn('2026-06-14 22:10:00');
    expect(formatDate(v, 'HH:mm')).toBe('22:10');
  });

  it('ไม่ข้ามไปวันถัดไป (เหตุการณ์ช่วงค่ำต้องคงวันเดิม)', () => {
    const v = fromTimestampColumn('2026-06-14 22:10:00');
    expect(formatDate(v, 'D MMM YYYY')).toBe('14 Jun 2026');
  });

  it('เวลาหลังเที่ยงคืนเล็กน้อยก็ยังถูกวัน', () => {
    const v = fromTimestampColumn('2026-06-15 00:32:00');
    expect(formatDate(v, 'D MMM YYYY HH:mm')).toBe('15 Jun 2026 00:32');
  });

  it('คอลัมน์ date (Drizzle map เป็น UTC-midnight) ไม่เพี้ยนวัน', () => {
    // MySqlDate.mapFromDriverValue = new Date('2026-06-14') → 2026-06-14T00:00:00Z
    const due = new Date('2026-06-14');
    expect(formatDate(due, 'YYYY-MM-DD')).toBe('2026-06-14');
  });
});

describe('bangkokYearMonth (instant จริง → เวลาไทย)', () => {
  it('แปลง instant จริงเป็นปี/เดือนตามเวลาไทย', () => {
    // 2026-06-14 18:00:00Z = 2026-06-15 01:00 น. ตามเวลาไทย → ต้องเป็นเดือน 6 ปี 2026
    expect(bangkokYearMonth(new Date('2026-06-14T18:00:00Z'))).toEqual({ year: 2026, month: 6 });
    // 2026-06-30 17:30:00Z = 2026-07-01 00:30 น. เวลาไทย → ข้ามเป็นเดือน 7
    expect(bangkokYearMonth(new Date('2026-06-30T17:30:00Z'))).toEqual({ year: 2026, month: 7 });
  });
});

describe('formatBaht', () => {
  it('จัดรูปแบบเงินบาทจาก string/number ของ decimal column', () => {
    expect(formatBaht('1234.5')).toBe('฿1,234.50');
    expect(formatBaht(0)).toBe('฿0.00');
  });
});

/**
 * DatePicker เก็บ/ส่งค่าเป็น string 'YYYY-MM-DD' แต่ react-day-picker ใช้ Date (local) —
 * คู่ ymdToDate/dateToYmd ต้อง round-trip โดยไม่เพี้ยนข้ามวันจาก timezone (ห้ามใช้ toISOString)
 */
describe('ymdToDate / dateToYmd (วันออกเอกสารใน DatePicker)', () => {
  it('round-trip คงวันเดิมทุกวันในเดือน', () => {
    for (const s of ['2026-06-24', '2026-01-01', '2026-12-31', '2026-02-28']) {
      expect(dateToYmd(ymdToDate(s)!)).toBe(s);
    }
  });

  it('ymdToDate สร้างเที่ยงคืน local ของวันที่ถูกต้อง (ไม่ off-by-one)', () => {
    const d = ymdToDate('2026-06-24')!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 6, 24]);
  });

  it('ค่าว่าง/รูปแบบผิด → undefined', () => {
    expect(ymdToDate('')).toBeUndefined();
    expect(ymdToDate('not-a-date')).toBeUndefined();
  });
});
