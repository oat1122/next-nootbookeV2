import { describe, expect, it } from 'vitest';
import {
  buildStandardGroups,
  dayKey,
  groupByDay,
  leadStatePill,
  renderSelfReport,
  renderStandardReport,
  timeFromDateLike,
  type StdDetailInput,
} from './report-pdf';

describe('pdf helpers', () => {
  it('timeFromDateLike: รองรับ datetime แบบ space และ date-only', () => {
    expect(timeFromDateLike('2025-06-24 09:02:00')).toBe('09.02');
    expect(timeFromDateLike('2025-06-24')).toBe('00.00');
    expect(timeFromDateLike(null)).toBe('');
  });

  it('dayKey: ตัดเหลือ YYYY-MM-DD', () => {
    expect(dayKey('2025-06-24 14:10:00')).toBe('2025-06-24');
    expect(dayKey('2025-06-24')).toBe('2025-06-24');
    expect(dayKey(null)).toBe('');
  });

  it('groupByDay: เรียงวันใหม่→เก่า, คงลำดับใน group', () => {
    const rows = [{ d: '2025-06-24', n: 1 }, { d: '2025-06-25', n: 2 }, { d: '2025-06-24', n: 3 }];
    const g = groupByDay(rows, (r) => r.d);
    expect(g.map((x) => x.key)).toEqual(['2025-06-25', '2025-06-24']);
    expect(g[1].rows.map((r) => r.n)).toEqual([1, 3]);
  });

  it('buildStandardGroups: นับ created/updated ต่อวัน', () => {
    const details = [
      { created_at: '2025-06-24 09:00:00', action_type: 'created' },
      { created_at: '2025-06-24 10:00:00', action_type: 'updated' },
      { created_at: '2025-06-24 11:00:00', action_type: 'created' },
    ].map((d) => ({ ...d, nb_customer_name: 'x', nb_contact_number: null, nb_status: null, nb_additional_info: null, nb_remarks: null, nb_action: null })) as StdDetailInput[];
    const [g] = buildStandardGroups(details);
    expect(g.dateKey).toBe('2025-06-24');
    expect(g.created).toBe(2);
    expect(g.updated).toBe(1);
    expect(g.rows).toHaveLength(3);
  });

  it('leadStatePill: converted > claimed > queue', () => {
    expect(leadStatePill({ nb_manage_by: 5, nb_converted_at: '2025-06-24' }).label).toBe('เป็นลูกค้าแล้ว');
    expect(leadStatePill({ nb_manage_by: 5, nb_converted_at: null }).label).toBe('รับงานแล้ว');
    expect(leadStatePill({ nb_manage_by: null, nb_converted_at: null }).label).toBe('อยู่ในคิวกลาง');
  });

  // end-to-end: ฟอนต์ไทย .ttf โหลดได้ (fontkit.open) + เรนเดอร์ไม่ throw → ได้ buffer ขึ้นต้น %PDF
  it('renderStandardReport: คืน PDF buffer ที่ valid', async () => {
    const buf = await renderStandardReport({
      rangeLabel: 'เดือนนี้',
      printedAt: '26 มิ.ย. 2568 14:32',
      printedBy: 'สมชาย ใจดี',
      details: [
        { created_at: '2025-06-24 09:00:00', action_type: 'created', nb_customer_name: 'บริษัท สยามกลการ จำกัด', nb_contact_number: '081-234-5678', nb_status: 'พิจารณา', nb_additional_info: 'นำเสนอเสื้อโปโล', nb_remarks: 'รอยืนยัน', nb_action: 'โทร' },
      ] as StdDetailInput[],
    });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
  });

  it('renderSelfReport: คืน PDF buffer ที่ valid (2 หน้า)', async () => {
    const buf = await renderSelfReport({
      rangeLabel: 'เดือนนี้',
      rangeShort: '24 – 25 มิ.ย. 2568',
      printedAt: '26 มิ.ย. 2568 14:32',
      printedBy: 'สมชาย ใจดี',
      leads: [
        { nb_customer_name: 'บริษัท สยามกลการ จำกัด', nb_contact_person: 'คุณวีระ', nb_contact_number: '081-234-5678', nb_status: 'พิจารณา', nb_manage_by: 5, nb_converted_at: null, created_at: '2025-06-24T09:02:00.000Z' },
      ],
      recalls: [
        { customer_name: 'หจก. ทรัพย์เจริญการช่าง', recall_note: 'โทรกลับตามนัด', was_overdue: true, days_overdue: 3, created_at: '2025-06-24T13:20:00.000Z' },
      ],
      activityItems: [
        { nb_customer_name: 'ร้านกาแฟบ้านสวน', nb_is_online: false, nb_contact_person: 'คุณนิด', nb_contact_number: '089-111-2222', nb_email: null, nb_additional_info: 'ปิดงานเสื้อยืด', nb_action: 'โทร', nb_status: 'ได้งาน', nb_remarks: 'มัดจำแล้ว', nb_date: '2025-06-24', nb_time: '10.40', nb_entry_type: 'standard', created_at: '2025-06-24T10:40:00.000Z' },
      ],
    });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
  });
});
