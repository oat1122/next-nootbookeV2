'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { dateToYmd, formatDate, ymdToDate } from '@/lib/format';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { notebookHref } from '../_lib/href';

/**
 * ตัวกรองช่วงเวลา (กรองตาม nb_date) — Popover + Calendar mode="range"
 * ขับด้วย URL ?start_date=&end_date= ('YYYY-MM-DD') เหมือน filter อื่นในหน้านี้
 */
export function DateRangeFilter({
  current,
  startDate,
  endDate,
}: {
  current: Record<string, string | undefined>;
  startDate?: string;
  endDate?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const committed: DateRange | undefined =
    startDate && endDate ? { from: ymdToDate(startDate), to: ymdToDate(endDate) } : undefined;
  const [pending, setPending] = React.useState<DateRange | undefined>(committed);

  // sync เมื่อ URL เปลี่ยนจากภายนอก (ปรับ state ตอน render ตามแนวทาง React)
  const key = `${startDate ?? ''}|${endDate ?? ''}`;
  const [prevKey, setPrevKey] = React.useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setPending(committed);
  }

  function apply(range: DateRange | undefined) {
    setPending(range);
    // commit เข้า URL เมื่อเลือกครบทั้งช่วง (from→to)
    if (range?.from && range?.to) {
      router.push(
        notebookHref(current, {
          start_date: dateToYmd(range.from),
          end_date: dateToYmd(range.to),
          page: null,
        }),
      );
      setOpen(false);
    }
  }

  function clear() {
    setPending(undefined);
    router.push(notebookHref(current, { start_date: null, end_date: null, page: null }));
    setOpen(false);
  }

  function onOpenChange(o: boolean) {
    setOpen(o);
    // ปิดทั้งที่เลือกยังไม่ครบ → คืนค่าที่ commit ไว้ กันค้างครึ่งช่วง
    if (!o && !(pending?.from && pending?.to)) setPending(committed);
  }

  const label = committed
    ? `${formatDate(startDate!, 'DD/MM/YY')} – ${formatDate(endDate!, 'DD/MM/YY')}`
    : 'เลือกช่วงเวลา';

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className={cn(
          'border-border hover:bg-surface-2 inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-3.5 text-[14px] font-medium outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-2',
          committed ? 'text-foreground' : 'text-ink-3',
        )}
      >
        <CalendarIcon className="text-ink-3 size-4 shrink-0" />
        <span>{label}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Calendar
          mode="range"
          // min={1}: คลิกแรกตั้งแค่ "วันเริ่ม" (to=undefined ยังไม่ปิด) คลิกที่สองตั้ง "วันสิ้นสุด"
          // ถ้าไม่ใส่ react-day-picker จะถือว่าคลิกเดียว = ช่วงครบ {from:X,to:X} แล้วปิดทันที
          min={1}
          selected={pending}
          defaultMonth={pending?.from}
          numberOfMonths={2}
          autoFocus
          onSelect={apply}
        />
        {committed && (
          <div className="border-border border-t p-2">
            <button
              type="button"
              onClick={clear}
              className="text-ink-2 hover:bg-surface-2 w-full rounded-md px-3 py-2 text-[13px] font-medium"
            >
              ล้างช่วงเวลา
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
