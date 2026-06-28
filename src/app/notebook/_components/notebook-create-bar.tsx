'use client';

import Link from 'next/link';
import { Download, Plus, NotebookPen, UserPlus, HeartHandshake, CalendarClock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotebookUI, type CreateType } from './notebook-ui';
import type { NotebookPerms } from '../_lib/types';

/** แถบปุ่ม header: ออกรายงาน (Link) + เมนูจดบันทึกใหม่ (เลือกชนิดตามสิทธิ์) */
export function NotebookCreateBar({ perms }: { perms: NotebookPerms }) {
  const ui = useNotebookUI();

  const items: { type: CreateType; label: string; icon: React.ReactNode; show: boolean }[] = [
    { type: 'standard', label: 'บันทึกลูกค้าใหม่', icon: <NotebookPen className="size-4" />, show: perms.canCreateStandard },
    {
      type: 'lead',
      label: 'สร้างลีดเข้าคิว',
      icon: <UserPlus className="size-4" />,
      show: perms.canCreateLeadQueue || perms.canCreateLeadMine,
    },
    { type: 'care', label: 'ดูแลลูกค้า', icon: <HeartHandshake className="size-4" />, show: perms.canCreateCare },
    { type: 'personal', label: 'ธุระส่วนตัว', icon: <CalendarClock className="size-4" />, show: perms.canCreatePersonal },
  ];
  const visible = items.filter((i) => i.show);

  return (
    <div className="flex items-center gap-2.5">
      <Link
        href="/notebook/report"
        className="border-border text-ink-2 hover:bg-surface-2 flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-[14px] font-medium"
      >
        <Download className="size-[18px]" />
        ออกรายงาน
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger className="bg-primary text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-[11px] text-[15px] font-semibold shadow-md transition hover:brightness-95">
          <Plus className="size-[19px]" />
          จดบันทึกใหม่
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {visible.map((i) => (
            <DropdownMenuItem key={i.type} onClick={() => ui.openCreate(i.type)} className="gap-2 py-2 text-[14px]">
              {i.icon}
              {i.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
