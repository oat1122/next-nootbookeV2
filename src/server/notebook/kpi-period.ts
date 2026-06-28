import 'server-only';

/**
 * พอร์ต NotebookKpiService::getDateRange + formatPeriod (pure — ไม่มี DB เพื่อให้เทสได้)
 * คืนช่วงวันที่เป็น string 'YYYY-MM-DD' (ใช้ BETWEEN กับ created_at ใน session tz +07:00)
 */

export type ResolvedPeriod = {
  type: string;
  start_date: string;
  end_date: string;
  label: string;
  /** ขอบเขตเต็มสำหรับ query: 'YYYY-MM-DD 00:00:00' .. 'YYYY-MM-DD 23:59:59' */
  start: string;
  end: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtThai = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const quarterOf = (m: number) => Math.floor(m / 3); // 0-based quarter index

function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7; // Mon=0 ... Sun=6
  x.setDate(x.getDate() - offset);
  return x;
}

export const isCreateAction = (action: string | null): boolean =>
  action === 'created' || action === 'created_to_queue' || action === 'created_to_mine';

export const normalizeHistoryAction = (action: string | null): 'created' | 'updated' =>
  isCreateAction(action) ? 'created' : 'updated';

/** now ฉีดได้เพื่อเทส (default = เวลาปัจจุบัน) */
export function resolvePeriod(
  period: string | null | undefined,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): ResolvedPeriod {
  const make = (type: string, start: Date, end: Date, label: string): ResolvedPeriod => ({
    type,
    start_date: fmt(start),
    end_date: fmt(end),
    label,
    start: `${fmt(start)} 00:00:00`,
    end: `${fmt(end)} 23:59:59`,
  });

  if (startDate && endDate) {
    const s = new Date(`${startDate}T00:00:00`);
    const e = new Date(`${endDate}T00:00:00`);
    return make(period ?? 'custom', s, e, `${fmtThai(s)} - ${fmtThai(e)}`);
  }

  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case 'today':
      return make('today', now, now, 'วันนี้');
    case 'week': {
      const s = mondayOf(now);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return make('week', s, e, 'สัปดาห์นี้');
    }
    case 'quarter': {
      const q = quarterOf(m);
      return make('quarter', new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 0), `ไตรมาสนี้ (Q${q + 1})`);
    }
    case 'year':
      return make('year', new Date(y, 0, 1), new Date(y, 11, 31), `ปีนี้ (${y})`);
    case 'prev_month':
      return make('prev_month', new Date(y, m - 1, 1), new Date(y, m, 0), 'เดือนที่แล้ว');
    case 'prev_week': {
      const s = mondayOf(now);
      s.setDate(s.getDate() - 7);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return make('prev_week', s, e, 'สัปดาห์ที่แล้ว');
    }
    case 'prev_quarter': {
      const pq = quarterOf(m) - 1;
      const py = pq < 0 ? y - 1 : y;
      const pqi = (pq + 4) % 4;
      return make(
        'prev_quarter',
        new Date(py, pqi * 3, 1),
        new Date(py, pqi * 3 + 3, 0),
        `ไตรมาสที่แล้ว (Q${pqi + 1})`,
      );
    }
    default:
      return make(period ?? 'month', new Date(y, m, 1), new Date(y, m + 1, 0), 'เดือนนี้');
  }
}
