'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { cn } from '@/lib/utils';
import type { NotebookStats } from '@/server/notebook/queries';
import type { Scope } from '../_lib/types';
import { notebookHref } from '../_lib/href';
import { rise, riseStagger } from '../_lib/motion';

const ICONS = {
  total: 'M4 19.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5a2 2 0 0 1 0-4H20',
  today: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18M12 14v3M12 14h3',
  overdue: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v4M12 16h.01',
  won: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  converted: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M16 11l2 2 4-4',
} as const;

const COLORS = {
  total: { bg: '#EFEAFB', fg: '#6D4FB0' },
  today: { bg: '#FCEFD2', fg: '#9A6A00' },
  overdue: { bg: '#FBE3DF', fg: '#C2554A' },
  won: { bg: '#DCF3E3', fg: '#1B7A45' },
  converted: { bg: '#D6EDF2', fg: '#1E7B8C' },
} as const;

// กดการ์ด → ล้างตัวกรองอื่น (status/action/search/date) ให้จำนวนแถวตรงเลขบนการ์ด
const RESET = {
  status: null,
  action: null,
  search: null,
  start_date: null,
  end_date: null,
  page: null,
} as const;

/** stat cards — กดได้ → กรองรายการตามเมตริก (server ส่งตัวเลข + current/metric ปัจจุบัน) */
export function StatCards({
  stats,
  scope,
  current,
  metric,
}: {
  stats: NotebookStats;
  scope: Scope;
  current: Record<string, string | undefined>;
  metric?: string;
}) {
  const totalLabel =
    scope === 'queue' ? 'ลีดในคิว' : scope === 'all' ? 'รายการทั้งหมด' : 'ลูกค้าทั้งหมด';

  const cards: { key: keyof typeof ICONS; value: number; label: string }[] = [
    { key: 'total', value: stats.total, label: totalLabel },
    { key: 'today', value: stats.dueToday, label: 'ต้องติดตามวันนี้' },
    { key: 'overdue', value: stats.overdue, label: 'เลยกำหนดแล้ว' },
    { key: 'won', value: stats.won, label: 'ได้งานแล้ว' },
    { key: 'converted', value: stats.converted, label: 'เป็นลูกค้าแล้ว' },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-5">
      {cards.map((c, i) => {
        const active = c.key === 'total' ? !metric : metric === c.key;
        const fg = COLORS[c.key].fg;
        return (
          <m.div key={c.key} initial={rise.initial} animate={rise.animate} transition={riseStagger(i)}>
            <Link
              href={notebookHref(current, { ...RESET, metric: c.key === 'total' ? null : c.key })}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex h-full items-center gap-3 rounded-2xl border bg-white px-[18px] py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                active ? 'border-transparent' : 'border-border',
              )}
              style={active ? { boxShadow: `0 0 0 2px ${fg}, 0 1px 2px rgba(0,0,0,.05)` } : undefined}
            >
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: COLORS[c.key].bg, color: fg }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-[21px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={ICONS[c.key]} />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="num text-[25px] leading-none font-bold">
                  {c.value.toLocaleString('th-TH')}
                </div>
                <div className="text-ink-3 mt-1 text-[13px]">{c.label}</div>
              </div>
            </Link>
          </m.div>
        );
      })}
    </div>
  );
}
