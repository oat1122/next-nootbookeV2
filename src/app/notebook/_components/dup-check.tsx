'use client';

import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { checkNotebookDuplicate } from '@/server/notebook/actions';

export type DupResult = { checking: boolean; customers: string[]; notebooks: string[] };
const EMPTY: DupResult = { checking: false, customers: [], notebooks: [] };

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const custName = (c: { cus_company: string | null; cus_name: string | null }) =>
  c.cus_company || c.cus_name || '—';

/**
 * เช็คเบอร์โทร + อีเมลซ้ำกับลูกค้า (master_customers) และ notebook อื่น แบบ debounce
 * — คืนรายชื่อที่ซ้ำแยกตามแหล่ง + สถานะ checking. ใช้ร่วมใน convert / create-edit / lead form
 * excludeId: ตัด notebook ตัวเองออก (โหมดแก้ไข) ไม่ให้ฟ้องว่าซ้ำกับตัวเอง
 */
export function useDupCheck(
  phone: string | null | undefined,
  email: string | null | undefined,
  excludeId: number | null = null,
): DupResult {
  const [res, setRes] = useState<DupResult>(EMPTY);
  const phoneV = (phone ?? '').trim();
  const emailV = (email ?? '').trim();

  useEffect(() => {
    const wantPhone = phoneV.replace(/[^0-9]/g, '').length >= 8;
    const wantEmail = isEmail(emailV);
    let alive = true;
    // setState ทั้งหมดอยู่ใน callback (เลี่ยง set-state-in-effect — เลียนแบบของเดิมใน lead form)
    const t = setTimeout(async () => {
      if (!wantPhone && !wantEmail) {
        setRes(EMPTY);
        return;
      }
      setRes((r) => ({ ...r, checking: true }));
      try {
        const calls: ReturnType<typeof checkNotebookDuplicate>[] = [];
        if (wantPhone)
          calls.push(checkNotebookDuplicate({ type: 'phone', value: phoneV, exclude_notebook_id: excludeId }));
        if (wantEmail)
          calls.push(checkNotebookDuplicate({ type: 'email', value: emailV, exclude_notebook_id: excludeId }));
        const out = await Promise.all(calls);
        if (!alive) return;
        const customers = [...new Set(out.flatMap((o) => o.customers.map(custName)))];
        const notebooks = [...new Set(out.flatMap((o) => o.notebooks.map((n) => n.nb_customer_name || '—')))];
        setRes({ checking: false, customers, notebooks });
      } catch {
        if (alive) setRes(EMPTY);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [phoneV, emailV, excludeId]);

  return res;
}

/** แบนเนอร์เตือนข้อมูลซ้ำ (เหลือง) — ไม่บล็อก แค่เตือนให้ตรวจสอบก่อนบันทึก */
export function DupWarning({ names, label }: { names: string[]; label?: string }) {
  if (names.length === 0) return null;
  const extra = names.length > 3 ? ` +${names.length - 3}` : '';
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]"
      style={{ background: '#FBF0DC', color: '#9A6A00' }}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div>
        <div className="font-semibold">{label ?? 'พบข้อมูลที่อาจซ้ำในระบบ'}</div>
        <div className="mt-0.5 opacity-90">
          {names.slice(0, 3).join(', ')}
          {extra} — ตรวจสอบก่อนบันทึก
        </div>
      </div>
    </div>
  );
}
