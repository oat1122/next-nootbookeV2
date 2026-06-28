'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { dateToYmd, formatDate, ymdToDate } from '@/lib/format';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * ตัวเลือกวันที่ (shadcn pattern: Popover + Calendar) — value/onChange เป็น string 'YYYY-MM-DD'
 * จึงวางแทน <input type="date"> ได้ทันที (state ของฟอร์มในระบบใช้ 'YYYY-MM-DD' อยู่แล้ว)
 * แสดงผลเป็น DD/MM/YYYY ให้ตรงกับ formatDate ที่ใช้บนเอกสาร/รายการ
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'เลือกวันที่',
  className,
  disabled,
  title,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = ymdToDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        className={cn(
          'flex items-center justify-between gap-2 text-left font-normal',
          'disabled:pointer-events-none disabled:opacity-50',
          !value && 'text-ink-3',
          className,
        )}
      >
        <span>{value ? formatDate(value, 'DD/MM/YYYY') : placeholder}</span>
        <CalendarIcon className="text-ink-3 size-4 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          autoFocus
          onSelect={(d) => {
            // คลิกวันที่เลือกอยู่ซ้ำ → react-day-picker คืน undefined = ล้างค่า (เทียบเท่า native ที่ล้างได้)
            onChange(d ? dateToYmd(d) : '');
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
