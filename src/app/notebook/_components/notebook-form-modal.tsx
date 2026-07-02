'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/lib/utils';
import { createNotebook, listBusinessTypes, updateNotebook } from '@/server/notebook/actions';
import { useNotebookAction } from '../_lib/run-action';
import { ACTION, ACTION_ORDER, STATUS, STATUS_ORDER } from '../_lib/notebook-display';
import { useDupCheck, DupWarning } from './dup-check';
import type { NotebookItem } from '../_lib/types';

/** ตัวเลือกหมวดหมู่ธุรกิจ — Combobox base-ui ใช้ { value, label } อัตโนมัติ */
type BizType = { value: string; label: string };

/** อ่าน cus_bt_id ที่เก็บใน nb_lead_payload (JSON) ของ notebook */
function leadBtId(item?: NotebookItem): string | null {
  const raw = item?.nb_lead_payload ? (item.nb_lead_payload as Record<string, unknown>).cus_bt_id : null;
  return raw == null || raw === '' ? null : String(raw);
}

type Draft = {
  nb_customer_name: string;
  nb_contact_person: string;
  nb_contact_number: string;
  nb_email: string;
  nb_is_online: boolean;
  nb_status: string;
  nb_additional_info: string;
  nb_action: string;
  nb_next_followup_date: string;
  nb_next_followup_note: string;
};

function emptyDraft(): Draft {
  return {
    nb_customer_name: '',
    nb_contact_person: '',
    nb_contact_number: '',
    nb_email: '',
    nb_is_online: false,
    nb_status: 'พิจารณา',
    nb_additional_info: '',
    nb_action: 'โทร',
    nb_next_followup_date: '',
    nb_next_followup_note: '',
  };
}

function fromItem(it: NotebookItem): Draft {
  return {
    nb_customer_name: it.nb_customer_name ?? '',
    nb_contact_person: it.nb_contact_person ?? '',
    nb_contact_number: it.nb_contact_number ?? '',
    nb_email: it.nb_email ?? '',
    nb_is_online: !!it.nb_is_online,
    nb_status: it.nb_status ?? 'พิจารณา',
    nb_additional_info: it.nb_additional_info ?? '',
    nb_action: it.nb_action ?? 'โทร',
    nb_next_followup_date: it.nb_next_followup_date ?? '',
    nb_next_followup_note: it.nb_next_followup_note ?? '',
  };
}

const trimOrNull = (s: string) => {
  const v = s.trim();
  return v === '' ? null : v;
};

/** ฟอร์มสร้าง/แก้ไข notebook มาตรฐาน (4 ขั้นตามดีไซน์) */
export function NotebookFormModal({
  mode,
  item,
  presetAction,
  onClose,
}: {
  mode: 'create' | 'edit';
  item?: NotebookItem;
  presetAction?: string;
  onClose: () => void;
}) {
  // presetAction (เช่น 'โทร' จากปุ่มโทรหาลูกค้า) ตั้ง "ขั้นตอนถัดไป" ไว้ให้ตั้งแต่เปิดฟอร์ม
  const [draft, setDraft] = useState<Draft>(() => {
    const d = item ? fromItem(item) : emptyDraft();
    return presetAction ? { ...d, nb_action: presetAction } : d;
  });
  const [error, setError] = useState('');
  const { pending, run } = useNotebookAction();
  const dup = useDupCheck(draft.nb_contact_number, draft.nb_email, mode === 'edit' ? (item?.id ?? null) : null);
  const dupNames = [...dup.customers, ...dup.notebooks];

  // หมวดหมู่ธุรกิจ — ดู/แก้ได้เฉพาะ entry ชนิดลูกค้า/ลีด (standard) ในโหมดแก้ไข
  const showBizType = mode === 'edit' && item?.nb_entry_type === 'standard';
  const [bizTypes, setBizTypes] = useState<BizType[]>([]);
  const [bizType, setBizType] = useState<BizType | null>(null);

  useEffect(() => {
    if (!showBizType) return;
    let alive = true;
    listBusinessTypes()
      .then((rows) => {
        if (!alive) return;
        const opts = rows.map((r) => ({ value: r.bt_id, label: r.bt_name }));
        setBizTypes(opts);
        const id = leadBtId(item);
        if (id) setBizType(opts.find((o) => o.value === id) ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [showBizType, item]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function save() {
    if (!draft.nb_customer_name.trim() || !draft.nb_contact_number.trim()) {
      setError('กรุณากรอกชื่อลูกค้าและเบอร์โทรก่อนบันทึก');
      return;
    }
    if (showBizType && !bizType) {
      setError('กรุณาเลือกหมวดหมู่ธุรกิจ');
      return;
    }
    setError('');
    const input = {
      nb_customer_name: draft.nb_customer_name.trim(),
      nb_contact_person: trimOrNull(draft.nb_contact_person),
      nb_contact_number: trimOrNull(draft.nb_contact_number),
      nb_email: trimOrNull(draft.nb_email),
      nb_is_online: draft.nb_is_online,
      nb_status: trimOrNull(draft.nb_status),
      nb_additional_info: trimOrNull(draft.nb_additional_info),
      nb_action: trimOrNull(draft.nb_action),
      nb_next_followup_date: trimOrNull(draft.nb_next_followup_date),
      nb_next_followup_note: trimOrNull(draft.nb_next_followup_note),
    };
    const action =
      mode === 'create'
        ? () => createNotebook(input)
        : () =>
            updateNotebook(
              item!.id,
              showBizType ? { ...input, cus_bt_id: bizType?.value ?? null } : input,
            );
    run(action, {
      success: mode === 'create' ? 'บันทึกลูกค้าใหม่เรียบร้อย' : 'อัปเดตการติดตามเรียบร้อย',
      onDone: onClose,
    });
  }

  const title = mode === 'create' ? 'จดบันทึกใหม่' : 'บันทึกการติดตาม';
  const subtitle =
    mode === 'create'
      ? 'เพิ่มลูกค้าหรือลีดใหม่เข้าสมุดจด'
      : `แก้ไข: ${draft.nb_customer_name || '—'}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-[760px]"
      >
        {/* header */}
        <div className="border-border flex items-center gap-3.5 border-b bg-white px-6 py-5">
          <div className="bg-primary text-primary-foreground flex size-[42px] items-center justify-center rounded-xl">
            <Save className="size-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold">{title}</div>
            <div className="text-ink-3 text-[13px]">{subtitle}</div>
          </div>
        </div>

        {/* body */}
        <div className="max-h-[calc(92vh-168px)] overflow-y-auto px-6 py-5">
          <Step n={1} label="ลูกค้าคือใคร" />
          <div className="border-border mb-[22px] rounded-2xl border bg-white p-[18px]">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="ชื่อลูกค้า / บริษัท" required>
                <Input
                  value={draft.nb_customer_name}
                  onChange={(e) => set('nb_customer_name', e.target.value)}
                  placeholder="เช่น บริษัท สยามแพ็คเกจจิ้ง"
                  className="h-11 rounded-xl bg-white text-[14.5px]"
                />
              </Field>
              <Field label="ชื่อผู้ติดต่อ">
                <Input
                  value={draft.nb_contact_person}
                  onChange={(e) => set('nb_contact_person', e.target.value)}
                  placeholder="เช่น คุณสมชาย"
                  className="h-11 rounded-xl bg-white text-[14.5px]"
                />
              </Field>
              <Field label="เบอร์โทร" required>
                <Input
                  value={draft.nb_contact_number}
                  onChange={(e) => set('nb_contact_number', e.target.value)}
                  placeholder="08x-xxx-xxxx"
                  className="h-11 rounded-xl bg-white text-[14.5px]"
                />
              </Field>
              <Field label="อีเมล">
                <Input
                  type="email"
                  value={draft.nb_email}
                  onChange={(e) => set('nb_email', e.target.value)}
                  placeholder="name@email.com"
                  className="h-11 rounded-xl bg-white text-[14.5px]"
                />
              </Field>
            </div>
            {showBizType && (
              <div className="mt-3.5">
                <Field label="หมวดหมู่ธุรกิจ" required>
                  <Combobox
                    items={bizTypes}
                    value={bizType}
                    onValueChange={(v) => setBizType((v as BizType | null) ?? null)}
                  >
                    <div className="relative">
                      <ComboboxInput
                        placeholder="ค้นหาและเลือกประเภทธุรกิจ..."
                        className="h-11 rounded-xl bg-white text-[14.5px]"
                      />
                      <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
                        {bizType && <ComboboxClear />}
                        <ComboboxIcon />
                      </div>
                    </div>
                    <ComboboxContent>
                      <ComboboxEmpty>ไม่พบประเภทธุรกิจ</ComboboxEmpty>
                      <ComboboxList>
                        {(o: BizType) => (
                          <ComboboxItem key={o.value} value={o}>
                            {o.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
              </div>
            )}

            <div className="mt-3.5">
              <FieldLabel>รู้จักลูกค้าจากไหน</FieldLabel>
              <div className="flex gap-2">
                <ToggleBtn active={draft.nb_is_online} onClick={() => set('nb_is_online', true)}>
                  ออนไลน์ (ทัก/โทรเข้ามา)
                </ToggleBtn>
                <ToggleBtn active={!draft.nb_is_online} onClick={() => set('nb_is_online', false)}>
                  ออนไซต์ (เจอหน้า/ออกพบ)
                </ToggleBtn>
              </div>
            </div>
            {dup.checking && dupNames.length === 0 && (
              <div className="mt-3.5 text-[13px] text-muted-foreground">กำลังตรวจสอบข้อมูลซ้ำ…</div>
            )}
            {dupNames.length > 0 && (
              <div className="mt-3.5">
                <DupWarning names={dupNames} />
              </div>
            )}
          </div>

          <Step n={2} label="ตอนนี้ดีลไปถึงไหนแล้ว" />
          <div className="mb-[22px] flex flex-wrap gap-2.5">
            {STATUS_ORDER.map((v) => {
              const s = STATUS[v];
              const on = draft.nb_status === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('nb_status', v)}
                  className="inline-flex items-center gap-1.5 rounded-full px-[15px] py-[9px] text-[13.5px] font-semibold transition-all"
                  style={{
                    border: `1.5px solid ${on ? s.dot : '#E6E0D7'}`,
                    background: on ? s.bg : '#fff',
                    color: on ? s.fg : '#857E74',
                  }}
                >
                  <span className="size-2 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </button>
              );
            })}
          </div>

          <Step n={3} label="คุยอะไรกันไปบ้าง" />
          <Textarea
            value={draft.nb_additional_info}
            onChange={(e) => set('nb_additional_info', e.target.value)}
            placeholder="สรุปสิ่งที่คุย ความต้องการของลูกค้า งบประมาณ และสิ่งที่ตกลงกัน..."
            className="mb-[22px] min-h-24 rounded-2xl bg-white text-[14.5px] leading-relaxed"
          />

          <Step n={4} label="ต้องทำอะไรต่อ" />
          <div className="border-border rounded-2xl border bg-white p-[18px]">
            <FieldLabel>ขั้นตอนถัดไป</FieldLabel>
            <div className="mb-4 flex flex-wrap gap-2">
              {ACTION_ORDER.map((v) => {
                const a = ACTION[v];
                const on = draft.nb_action === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('nb_action', v)}
                    className="rounded-full px-[15px] py-[9px] text-[13.5px] font-semibold transition-all"
                    style={{
                      border: `1.5px solid ${on ? a.fg : '#E6E0D7'}`,
                      background: on ? a.bg : '#fff',
                      color: on ? a.fg : '#857E74',
                    }}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_1.4fr]">
              <Field label="วันที่ต้องติดตาม">
                <DatePicker
                  value={draft.nb_next_followup_date}
                  onChange={(v) => set('nb_next_followup_date', v)}
                  className="h-11 w-full rounded-xl border-input border bg-white px-3 text-[14.5px]"
                />
              </Field>
              <Field label="สิ่งที่ต้องทำครั้งหน้า">
                <Input
                  value={draft.nb_next_followup_note}
                  onChange={(e) => set('nb_next_followup_note', e.target.value)}
                  placeholder="เช่น โทรถามเรื่องใบเสนอราคา"
                  className="h-11 rounded-xl bg-white text-[14.5px]"
                />
              </Field>
            </div>
          </div>

          {error && (
            <div
              className="mt-4 flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] font-medium"
              style={{ background: '#FBE3DF', color: '#B23A2B' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="border-border flex justify-end gap-2.5 border-t bg-white/95 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border-border text-ink-2 rounded-xl border bg-white px-[22px] py-3 text-[14.5px] font-medium hover:bg-surface-2"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className={cn(
              'bg-primary text-primary-foreground flex items-center gap-2 rounded-xl px-[26px] py-3 text-[14.5px] font-semibold shadow-md transition hover:brightness-95',
              pending && 'opacity-60',
            )}
          >
            <Save className="size-[18px]" />
            {mode === 'create' ? 'บันทึกลูกค้าใหม่' : 'บันทึกการติดตาม'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-[13px] font-bold">
        {n}
      </span>
      <span className="text-[15px] font-bold">{label}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-ink-2 mb-[7px] block text-[13px] font-semibold">{children}</span>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-ink-2 mb-1.5 block text-[13px] font-semibold">
        {label} {required && <span style={{ color: '#D5503D' }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-xl px-3 py-[11px] text-[14px] font-semibold transition-all"
      style={{
        border: `1.5px solid ${active ? '#E1543B' : '#E6E0D7'}`,
        background: active ? '#FCEEEA' : '#fff',
        color: active ? '#E1543B' : '#857E74',
      }}
    >
      {children}
    </button>
  );
}
