'use client';

import { useRouter } from 'next/navigation';
import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { notebookHref } from '../_lib/href';

type Owner = { value: number; label: string };

/** ตัวกรอง "ผู้ดูแล" (แท็บทั้งหมด) — Combobox ค้นหาได้ ขับด้วย URL ?manage_by= */
export function UserFilter({
  current,
  owners,
  value,
}: {
  current: Record<string, string | undefined>;
  owners: Owner[];
  value?: number;
}) {
  const router = useRouter();
  const selected = owners.find((o) => o.value === value) ?? null;

  function pick(o: Owner | null) {
    router.push(notebookHref(current, { manage_by: o ? o.value : null, page: null }));
  }

  return (
    <Combobox items={owners} value={selected} onValueChange={(v) => pick(v as Owner | null)}>
      <div className="relative w-full sm:w-[260px]">
        <ComboboxInput placeholder="กรองตามผู้ดูแล..." />
        <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
          {selected && <ComboboxClear />}
          <ComboboxIcon />
        </div>
      </div>
      <ComboboxContent>
        <ComboboxEmpty>ไม่พบผู้ดูแล</ComboboxEmpty>
        <ComboboxList>
          {(o: Owner) => (
            <ComboboxItem key={o.value} value={o}>
              {o.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
