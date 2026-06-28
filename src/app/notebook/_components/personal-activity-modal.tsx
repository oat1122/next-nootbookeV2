'use client';

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createPersonalActivityNotebook } from '@/server/notebook/actions';
import { useNotebookAction } from '../_lib/run-action';
import { bangkokToday } from '../_lib/notebook-display';
import { ModalShell, FormField } from './modal-shell';

/** สร้างกิจกรรมส่วนตัว — แค่วันที่ + บันทึก */
export function PersonalActivityModal({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(() => bangkokToday());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const { pending, run } = useNotebookAction();

  function save() {
    if (!date || !note.trim()) {
      setError('กรุณาเลือกวันที่และกรอกรายละเอียด');
      return;
    }
    setError('');
    run(() => createPersonalActivityNotebook({ nb_date: date, nb_additional_info: note.trim() }), {
      success: 'บันทึกธุระส่วนตัวแล้ว',
      onDone: onClose,
    });
  }

  return (
    <ModalShell
      icon={<CalendarClock className="size-[22px]" />}
      title="บันทึกธุระส่วนตัว"
      subtitle="จดกิจกรรมส่วนตัวที่ใช้เวลางาน"
      saveLabel="บันทึก"
      pending={pending}
      onClose={onClose}
      onSave={save}
      width={520}
    >
      <div className="grid gap-3.5">
        <FormField label="วันที่" required>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 rounded-xl bg-white text-[14.5px]"
          />
        </FormField>
        <FormField label="รายละเอียด" required>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ลากิจช่วงบ่าย / ประชุมภายใน"
            className="min-h-24 rounded-2xl bg-white text-[14.5px] leading-relaxed"
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
