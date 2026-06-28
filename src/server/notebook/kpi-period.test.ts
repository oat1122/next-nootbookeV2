import { describe, expect, it } from 'vitest';
import { isCreateAction, normalizeHistoryAction, resolvePeriod } from './kpi-period';

// ตรึงเวลา: 28 มิ.ย. 2026 (อยู่ใน Q2, เดือน 6)
const NOW = new Date(2026, 5, 28, 10, 0, 0);

describe('resolvePeriod', () => {
  it('month (default)', () => {
    const p = resolvePeriod('month', null, null, NOW);
    expect(p.start_date).toBe('2026-06-01');
    expect(p.end_date).toBe('2026-06-30');
    expect(p.start).toBe('2026-06-01 00:00:00');
    expect(p.end).toBe('2026-06-30 23:59:59');
    expect(p.label).toBe('เดือนนี้');
  });

  it('quarter → Q2', () => {
    const p = resolvePeriod('quarter', null, null, NOW);
    expect(p.start_date).toBe('2026-04-01');
    expect(p.end_date).toBe('2026-06-30');
    expect(p.label).toBe('ไตรมาสนี้ (Q2)');
  });

  it('year', () => {
    const p = resolvePeriod('year', null, null, NOW);
    expect(p.start_date).toBe('2026-01-01');
    expect(p.end_date).toBe('2026-12-31');
  });

  it('prev_month', () => {
    const p = resolvePeriod('prev_month', null, null, NOW);
    expect(p.start_date).toBe('2026-05-01');
    expect(p.end_date).toBe('2026-05-31');
  });

  it('week เริ่มวันจันทร์ ครอบคลุม 7 วัน', () => {
    const p = resolvePeriod('week', null, null, NOW);
    const start = new Date(`${p.start_date}T00:00:00`);
    const end = new Date(`${p.end_date}T00:00:00`);
    expect(start.getDay()).toBe(1); // Monday
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(6);
  });

  it('custom dates ชนะ period', () => {
    const p = resolvePeriod('month', '2026-03-10', '2026-03-20', NOW);
    expect(p.start_date).toBe('2026-03-10');
    expect(p.end_date).toBe('2026-03-20');
    expect(p.label).toBe('10/03/2026 - 20/03/2026');
  });
});

describe('history action helpers', () => {
  it('isCreateAction / normalizeHistoryAction', () => {
    expect(isCreateAction('created_to_queue')).toBe(true);
    expect(isCreateAction('reserved')).toBe(false);
    expect(normalizeHistoryAction('created')).toBe('created');
    expect(normalizeHistoryAction('assigned')).toBe('updated');
  });
});
