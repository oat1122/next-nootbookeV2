'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createLeadNotebook } from '@/server/notebook/actions';
import { useNotebookAction } from '../_lib/run-action';
import { ModalShell, FormField } from './modal-shell';
import { useDupCheck, DupWarning } from './dup-check';
import { useNotebookUI } from './notebook-ui';

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** สร้างลีดใหม่ (lead_queue/standard ตามสิทธิ์) + เตือนเบอร์/อีเมลซ้ำสด ๆ */
export function LeadFormModal({ onClose }: { onClose: () => void }) {
  const { perms } = useNotebookUI();
  const bothScopes = perms.canCreateLeadQueue && perms.canCreateLeadMine;
  const defaultScope: 'queue' | 'mine' = perms.canCreateLeadQueue ? 'queue' : 'mine';

  const [company, setCompany] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [tel1, setTel1] = useState('');
  const [tel2, setTel2] = useState('');
  const [email, setEmail] = useState('');
  const [online, setOnline] = useState(true);
  const [note, setNote] = useState('');
  const [remark, setRemark] = useState('');
  const [scope, setScope] = useState<'queue' | 'mine'>(defaultScope);
  const [error, setError] = useState('');
  const { pending, run } = useNotebookAction();
  const dup = useDupCheck(tel1, email);
  const dupNames = [...dup.customers, ...dup.notebooks];

  function save() {
    if (!firstname.trim() || !lastname.trim() || !tel1.trim()) {
      setError('กรุณากรอกชื่อ นามสกุล และเบอร์โทร');
      return;
    }
    const cusName = (company.trim() || `${firstname.trim()} ${lastname.trim()}`.trim());
    setError('');
    run(
      () =>
        createLeadNotebook({
          cus_channel: online ? 2 : 1,
          target_scope: bothScopes ? scope : defaultScope,
          cus_company: trimOrNull(company),
          cus_name: cusName,
          cus_firstname: firstname.trim(),
          cus_lastname: lastname.trim(),
          cus_tel_1: tel1.trim(),
          cus_tel_2: trimOrNull(tel2),
          cus_email: trimOrNull(email),
          cd_note: trimOrNull(note),
          cd_remark: trimOrNull(remark),
          is_possible_duplicate: dupNames.length > 0,
        }),
      { success: 'สร้างลีดใหม่เรียบร้อย', onDone: onClose },
    );
  }

  return (
    <ModalShell
      icon={<UserPlus className="size-[22px]" />}
      title="สร้างลีดใหม่"
      subtitle="เพิ่มผู้สนใจเข้าคิว หรือเข้าความดูแลของคุณ"
      saveLabel="สร้างลีด"
      pending={pending}
      onClose={onClose}
      onSave={save}
      width={680}
    >
      <div className="grid gap-3.5">
        {bothScopes && (
          <div className="flex gap-2">
            {(['queue', 'mine'] as const).map((s) => {
              const on = scope === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className="flex-1 rounded-xl px-3 py-[11px] text-[14px] font-semibold transition-all"
                  style={{
                    border: `1.5px solid ${on ? '#E1543B' : '#E6E0D7'}`,
                    background: on ? '#FCEEEA' : '#fff',
                    color: on ? '#E1543B' : '#857E74',
                  }}
                >
                  {s === 'queue' ? 'เข้าคิวกลาง' : 'เป็นของฉัน'}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FormField label="บริษัท">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="เช่น บริษัท ..." className="h-11 rounded-xl bg-white text-[14.5px]" />
          </FormField>
          <FormField label="เบอร์โทร" required>
            <Input value={tel1} onChange={(e) => setTel1(e.target.value)} placeholder="08x-xxx-xxxx" className="h-11 rounded-xl bg-white text-[14.5px]" />
          </FormField>
          <FormField label="ชื่อ" required>
            <Input value={firstname} onChange={(e) => setFirstname(e.target.value)} className="h-11 rounded-xl bg-white text-[14.5px]" />
          </FormField>
          <FormField label="นามสกุล" required>
            <Input value={lastname} onChange={(e) => setLastname(e.target.value)} className="h-11 rounded-xl bg-white text-[14.5px]" />
          </FormField>
          <FormField label="เบอร์โทรสำรอง">
            <Input value={tel2} onChange={(e) => setTel2(e.target.value)} className="h-11 rounded-xl bg-white text-[14.5px]" />
          </FormField>
          <FormField label="อีเมล">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" className="h-11 rounded-xl bg-white text-[14.5px]" />
          </FormField>
        </div>

        <DupWarning names={dupNames} label="เบอร์/อีเมลนี้อาจซ้ำกับรายการที่มีอยู่" />

        <div>
          <span className="text-ink-2 mb-1.5 block text-[13px] font-semibold">รู้จักจากไหน</span>
          <div className="flex gap-2">
            {[
              { v: true, label: 'ออนไลน์' },
              { v: false, label: 'ออนไซต์' },
            ].map((o) => {
              const on = online === o.v;
              return (
                <button
                  key={String(o.v)}
                  type="button"
                  onClick={() => setOnline(o.v)}
                  className="flex-1 rounded-xl px-3 py-[11px] text-[14px] font-semibold transition-all"
                  style={{
                    border: `1.5px solid ${on ? '#E1543B' : '#E6E0D7'}`,
                    background: on ? '#FCEEEA' : '#fff',
                    color: on ? '#E1543B' : '#857E74',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <FormField label="โน้ต (ความต้องการลูกค้า)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="สนใจสินค้าอะไร งบประมาณ ฯลฯ" className="min-h-20 rounded-2xl bg-white text-[14.5px] leading-relaxed" />
        </FormField>
        <FormField label="หมายเหตุภายใน">
          <Input value={remark} onChange={(e) => setRemark(e.target.value)} className="h-11 rounded-xl bg-white text-[14.5px]" />
        </FormField>

        {error && (
          <div className="rounded-xl px-3.5 py-3 text-[13.5px] font-medium" style={{ background: '#FBE3DF', color: '#B23A2B' }}>
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
