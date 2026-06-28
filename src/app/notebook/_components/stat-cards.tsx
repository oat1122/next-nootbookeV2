'use client';

import { m } from 'motion/react';
import type { NotebookStats } from '@/server/notebook/queries';
import type { Scope } from '../_lib/types';
import { rise, riseStagger } from '../_lib/motion';

const ICONS = {
  total: 'M4 19.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5a2 2 0 0 1 0-4H20',
  today: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18M12 14v3M12 14h3',
  overdue: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v4M12 16h.01',
  won: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
} as const;

const COLORS = {
  total: { bg: '#EFEAFB', fg: '#6D4FB0' },
  today: { bg: '#FCEFD2', fg: '#9A6A00' },
  overdue: { bg: '#FBE3DF', fg: '#C2554A' },
  won: { bg: '#DCF3E3', fg: '#1B7A45' },
} as const;

/** stat cards 4 ตัว — server (รับตัวเลขจาก getNotebookStats) */
export function StatCards({ stats, scope }: { stats: NotebookStats; scope: Scope }) {
  const totalLabel =
    scope === 'queue' ? 'ลีดในคิว' : scope === 'all' ? 'รายการทั้งหมด' : 'ลูกค้าทั้งหมด';

  const cards: { key: keyof typeof ICONS; value: number; label: string }[] = [
    { key: 'total', value: stats.total, label: totalLabel },
    { key: 'today', value: stats.dueToday, label: 'ต้องติดตามวันนี้' },
    { key: 'overdue', value: stats.overdue, label: 'เลยกำหนดแล้ว' },
    { key: 'won', value: stats.won, label: 'ได้งานแล้ว' },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
      {cards.map((c, i) => (
        <m.div
          key={c.key}
          initial={rise.initial}
          animate={rise.animate}
          transition={riseStagger(i)}
          className="border-border flex items-center gap-3 rounded-2xl border bg-white px-[18px] py-4 shadow-sm"
        >
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: COLORS[c.key].bg, color: COLORS[c.key].fg }}
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
        </m.div>
      ))}
    </div>
  );
}
