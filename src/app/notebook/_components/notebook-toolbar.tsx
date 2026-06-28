'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { notebookHref } from '../_lib/href';
import { STATUS, STATUS_ORDER } from '../_lib/notebook-display';
import type { ViewMode } from '../_lib/types';

/** toolbar: ค้นหา (debounce→URL) + status chips + table/card toggle */
export function NotebookToolbar({
  current,
  status,
  view,
  search,
}: {
  current: Record<string, string | undefined>;
  status?: string;
  view: ViewMode;
  search: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // sync เมื่อ URL เปลี่ยนจากภายนอก (ปรับ state ตอน render ตามแนะนำของ React — เลี่ยง setState ใน effect)
  if (search !== prevSearch) {
    setPrevSearch(search);
    setTerm(search);
  }

  function onSearch(value: string) {
    setTerm(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      router.push(notebookHref(current, { search: value || null, page: null }));
    }, 350);
  }

  const chips = [{ v: 'all', label: 'ทั้งหมด', dot: null as string | null }].concat(
    STATUS_ORDER.map((v) => ({ v, label: STATUS[v].label, dot: STATUS[v].dot })),
  );

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[240px] flex-1">
        <svg
          viewBox="0 0 24 24"
          className="text-ink-4 absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4-4" />
        </svg>
        <input
          value={term}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="ค้นหาชื่อลูกค้า เบอร์โทร หรือผู้ติดต่อ..."
          className="border-border focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-xl border bg-white pr-3.5 pl-10 text-[14.5px] outline-none focus-visible:ring-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => {
          const on = (status ?? 'all') === c.v;
          return (
            <button
              key={c.v}
              type="button"
              onClick={() =>
                router.push(notebookHref(current, { status: c.v === 'all' ? null : c.v, page: null }))
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-ink-2 bg-white hover:bg-surface-2',
              )}
            >
              {c.dot && (
                <span
                  className="size-[7px] rounded-full"
                  style={{ background: on ? '#fff' : c.dot }}
                />
              )}
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-0.5 rounded-xl p-[3px]" style={{ background: '#F0EBE3' }}>
        <ViewBtn current={current} mode="table" active={view === 'table'} />
        <ViewBtn current={current} mode="card" active={view === 'card'} />
      </div>
    </div>
  );
}

function ViewBtn({
  current,
  mode,
  active,
}: {
  current: Record<string, string | undefined>;
  mode: ViewMode;
  active: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      title={mode === 'table' ? 'มุมมองตาราง' : 'มุมมองการ์ด'}
      onClick={() => router.push(notebookHref(current, { view: mode === 'table' ? null : mode }))}
      className={cn(
        'flex h-8 w-[38px] items-center justify-center rounded-[9px] transition-all',
        active ? 'text-foreground bg-white shadow-sm' : 'text-ink-3',
      )}
    >
      {mode === 'table' ? (
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 5h18M3 12h18M3 19h18" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )}
    </button>
  );
}
