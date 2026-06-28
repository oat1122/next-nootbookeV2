'use client';

import { UserPlus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDupCheck, DupWarning } from './dup-check';
import type { NotebookItem } from '../_lib/types';

/** ยืนยันแปลง notebook เป็นลูกค้า + เตือนถ้าเบอร์/อีเมลซ้ำกับลูกค้าในระบบ (ไม่บล็อก) */
export function ConvertConfirm({
  item,
  pending,
  onClose,
  onConfirm,
}: {
  item: NotebookItem;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dup = useDupCheck(item.nb_contact_number, item.nb_email, item.id);

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia style={{ background: '#EAF6EE', color: '#1E7A45' }}>
            <UserPlus />
          </AlertDialogMedia>
          <AlertDialogTitle>สร้างเป็นลูกค้า?</AlertDialogTitle>
          <AlertDialogDescription>
            ยืนยันแปลง “{item.nb_customer_name || '—'}” เป็นลูกค้าในระบบ
          </AlertDialogDescription>
        </AlertDialogHeader>

        {dup.checking && dup.customers.length === 0 && (
          <div className="px-1 text-[13px] text-muted-foreground">กำลังตรวจสอบข้อมูลซ้ำ…</div>
        )}
        <DupWarning names={dup.customers} label="พบลูกค้าที่อาจซ้ำในระบบ" />

        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="text-white"
            style={{ background: '#1E7A45' }}
          >
            ยืนยัน
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
