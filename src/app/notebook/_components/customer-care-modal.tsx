'use client';

import { useEffect, useRef, useState } from 'react';
import { HeartHandshake, Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  createCustomerCareNotebook,
  searchCustomerCareSources,
} from '@/server/notebook/actions';
import { useNotebookAction } from '../_lib/run-action';
import { bangkokToday, STATUS, STATUS_ORDER, ACTION, ACTION_ORDER } from '../_lib/notebook-display';
import { ModalShell, FormField } from './modal-shell';

type SourceType = 'customer' | 'notebook';
type Picked = { id: string | number; label: string; sub: string };

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** สร้าง entry ดูแลลูกค้า — เลือกต้นทาง (ลูกค้า/notebook) แล้วกรอกการติดตาม */
export function CustomerCareModal({ onClose }: { onClose: () => void }) {
  const [sourceType, setSourceType] = useState<SourceType>('customer');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Picked[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [date, setDate] = useState(() => bangkokToday());
  const [status, setStatus] = useState('');
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [followDate, setFollowDate] = useState('');
  const [followNote, setFollowNote] = useState('');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pending, run } = useNotebookAction();

  // โหลดรายการต้นทางเมื่อเปลี่ยนชนิด/คำค้น (debounce)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCustomerCareSources({
          source: sourceType,
          search: query || null,
          page: 1,
          per_page: 8,
        });
        if (res.source === 'customer') {
          setResults(
            res.data.map((c) => ({
              id: c.cus_id,
              label: c.cus_company || c.cus_name || `${c.cus_firstname ?? ''} ${c.cus_lastname ?? ''}`.trim() || '—',
              sub: [c.cus_tel_1, c.cus_email].filter(Boolean).join(' · ') || '—',
            })),
          );
        } else {
          setResults(
            res.data.map((n) => ({
              id: n.id,
              label: n.nb_customer_name || '—',
              sub: [n.nb_contact_number, n.nb_email].filter(Boolean).join(' · ') || '—',
            })),
          );
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sourceType, query]);

  function switchSource(t: SourceType) {
    setSourceType(t);
    setPicked(null);
    setQuery('');
  }

  function save() {
    if (!picked) {
      setError('กรุณาเลือกต้นทาง (ลูกค้า/notebook) ก่อน');
      return;
    }
    if (!date) {
      setError('กรุณาเลือกวันที่');
      return;
    }
    setError('');
    run(
      () =>
        createCustomerCareNotebook({
          nb_date: date,
          nb_additional_info: trimOrNull(note),
          nb_action: action || null,
          nb_status: status || null,
          nb_next_followup_date: trimOrNull(followDate),
          nb_next_followup_note: trimOrNull(followNote),
          source_type: sourceType,
          source_customer_id: sourceType === 'customer' ? String(picked.id) : null,
          source_notebook_id: sourceType === 'notebook' ? Number(picked.id) : null,
        }),
      { success: 'บันทึกการดูแลลูกค้าแล้ว', onDone: onClose },
    );
  }

  return (
    <ModalShell
      icon={<HeartHandshake className="size-[22px]" />}
      title="ดูแลลูกค้า"
      subtitle="บันทึกการติดตามลูกค้าเดิมหรือ notebook ที่มีอยู่"
      saveLabel="บันทึกการดูแล"
      pending={pending}
      onClose={onClose}
      onSave={save}
      width={680}
    >
      <div className="grid gap-4">
        {/* source type toggle */}
        <div className="flex gap-2">
          {(['customer', 'notebook'] as SourceType[]).map((t) => {
            const on = sourceType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => switchSource(t)}
                className="flex-1 rounded-xl px-3 py-[11px] text-[14px] font-semibold transition-all"
                style={{
                  border: `1.5px solid ${on ? '#E1543B' : '#E6E0D7'}`,
                  background: on ? '#FCEEEA' : '#fff',
                  color: on ? '#E1543B' : '#857E74',
                }}
              >
                {t === 'customer' ? 'จากลูกค้าเดิม' : 'จาก notebook'}
              </button>
            );
          })}
        </div>

        {/* search + results */}
        <div>
          <div className="relative">
            <Search className="text-ink-4 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ / เบอร์ / อีเมล..."
              className="h-11 rounded-xl bg-white pl-9 text-[14.5px]"
            />
          </div>
          <div className="border-border mt-2 max-h-52 overflow-y-auto rounded-xl border bg-white">
            {loading ? (
              <div className="text-ink-4 px-3 py-4 text-center text-[13px]">กำลังค้นหา...</div>
            ) : results.length === 0 ? (
              <div className="text-ink-4 px-3 py-4 text-center text-[13px]">ไม่พบรายการ</div>
            ) : (
              results.map((r) => {
                const on = picked?.id === r.id;
                return (
                  <button
                    key={`${r.id}`}
                    type="button"
                    onClick={() => setPicked(r)}
                    className={cn(
                      'border-border flex w-full items-center gap-2 border-b px-3 py-2.5 text-left last:border-0',
                      on ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{r.label}</div>
                      <div className="text-ink-4 truncate text-[12.5px]">{r.sub}</div>
                    </div>
                    {on && <Check className="text-primary size-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FormField label="วันที่" required>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl bg-white text-[14.5px]"
            />
          </FormField>
          <FormField label="ติดตามครั้งหน้า">
            <Input
              type="date"
              value={followDate}
              onChange={(e) => setFollowDate(e.target.value)}
              className="h-11 rounded-xl bg-white text-[14.5px]"
            />
          </FormField>
        </div>

        <ChipPicker label="สถานะ" order={STATUS_ORDER} meta={STATUS} value={status} onChange={setStatus} />
        <ChipPicker label="ขั้นตอนถัดไป" order={ACTION_ORDER} meta={ACTION} value={action} onChange={setAction} />

        <FormField label="สิ่งที่ต้องทำครั้งหน้า">
          <Input
            value={followNote}
            onChange={(e) => setFollowNote(e.target.value)}
            placeholder="เช่น โทรเช็คความพอใจหลังส่งงาน"
            className="h-11 rounded-xl bg-white text-[14.5px]"
          />
        </FormField>

        <FormField label="รายละเอียดการดูแล">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="สรุปสิ่งที่คุยกับลูกค้า..."
            className="min-h-20 rounded-2xl bg-white text-[14.5px] leading-relaxed"
          />
        </FormField>

        {error && (
          <div
            className="rounded-xl px-3.5 py-3 text-[13.5px] font-medium"
            style={{ background: '#FBE3DF', color: '#B23A2B' }}
          >
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/** แถว chip เลือกค่าเดียว (คลิกซ้ำ = ยกเลิก) — ใช้กับ status/action */
function ChipPicker({
  label,
  order,
  meta,
  value,
  onChange,
}: {
  label: string;
  order: string[];
  meta: Record<string, { label: string; bg: string; fg: string; dot?: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="text-ink-2 mb-1.5 block text-[13px] font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2">
        {order.map((v) => {
          const m = meta[v];
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(on ? '' : v)}
              className="rounded-full px-[13px] py-2 text-[13px] font-semibold transition-all"
              style={{
                border: `1.5px solid ${on ? m.fg : '#E6E0D7'}`,
                background: on ? m.bg : '#fff',
                color: on ? m.fg : '#857E74',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
