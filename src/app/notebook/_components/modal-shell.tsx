'use client';

import type { ReactNode } from 'react';
import { Save } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** โครง modal ร่วม (header ไอคอน+หัวข้อ, body เลื่อนได้, footer ยกเลิก/บันทึก) */
export function ModalShell({
  icon,
  title,
  subtitle,
  saveLabel,
  pending,
  onClose,
  onSave,
  width = 760,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  saveLabel: string;
  pending: boolean;
  onClose: () => void;
  onSave: () => void;
  width?: number;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92vh] gap-0 overflow-hidden p-0"
        style={{ maxWidth: `min(${width}px, 100%)` }}
      >
        <div className="border-border flex items-center gap-3.5 border-b bg-white px-6 py-5">
          <div className="bg-primary text-primary-foreground flex size-[42px] items-center justify-center rounded-xl">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold">{title}</div>
            {subtitle && <div className="text-ink-3 text-[13px]">{subtitle}</div>}
          </div>
        </div>

        <div className="max-h-[calc(92vh-168px)] overflow-y-auto px-6 py-5">{children}</div>

        <div className="border-border flex justify-end gap-2.5 border-t bg-white/95 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border-border text-ink-2 hover:bg-surface-2 rounded-xl border bg-white px-[22px] py-3 text-[14.5px] font-medium"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className={cn(
              'bg-primary text-primary-foreground flex items-center gap-2 rounded-xl px-[26px] py-3 text-[14.5px] font-semibold shadow-md transition hover:brightness-95',
              pending && 'opacity-60',
            )}
          >
            <Save className="size-[18px]" />
            {saveLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** label + ช่องกรอกแบบมาตรฐานของฟอร์ม notebook */
export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
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
