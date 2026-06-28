'use client';

import { Eye, Pencil, UserPlus, Trash2, NotebookPen, HandHelping, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOLLOW, followInfo } from '../_lib/notebook-display';
import { Avatar, StatusChip, ActionChip, FollowChip } from './chips';
import { useNotebookUI } from './notebook-ui';
import type { NotebookItem, Scope, ViewMode } from '../_lib/types';

const GRID = 'grid grid-cols-[2.4fr_1.5fr_1.2fr_1.4fr_1.5fr_1.3fr] gap-2';

export function NotebookBoard({
  notebooks,
  view,
  scope,
}: {
  notebooks: NotebookItem[];
  view: ViewMode;
  scope: Scope;
}) {
  const ui = useNotebookUI();

  if (notebooks.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-3.5 rounded-2xl border border-dashed bg-white px-5 py-16 text-center">
        <div
          className="flex size-16 items-center justify-center rounded-2xl"
          style={{ background: '#F4EFE8', color: '#C2B9AC' }}
        >
          <NotebookPen className="size-7" />
        </div>
        <div className="text-[17px] font-semibold">ยังไม่มีรายการตรงกับที่ค้นหา</div>
        <div className="text-ink-2 max-w-[340px] text-[14px]">
          ลองล้างตัวกรอง หรือกดปุ่ม “จดบันทึกใหม่” เพื่อเริ่มบันทึกลูกค้ารายแรก
        </div>
        <button
          type="button"
          onClick={() => ui.openCreate('standard')}
          className="bg-primary text-primary-foreground mt-1 rounded-xl px-[18px] py-2.5 font-semibold"
        >
          + จดบันทึกใหม่
        </button>
      </div>
    );
  }

  if (view === 'card') {
    return (
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {notebooks.map((n) => (
          <CardRow key={n.id} item={n} scope={scope} />
        ))}
      </div>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className={cn(GRID, 'text-ink-3 border-border border-b bg-[#FBF8F3] px-5 py-3.5 text-[12.5px] font-semibold')}>
        <div>ลูกค้า / ลีด</div>
        <div>ติดต่อ</div>
        <div>สถานะ</div>
        <div>ขั้นตอนถัดไป</div>
        <div>ติดตามครั้งหน้า</div>
        <div className="text-right">จัดการ</div>
      </div>
      {notebooks.map((n) => (
        <TableRow key={n.id} item={n} scope={scope} />
      ))}
    </div>
  );
}

function useRowState(item: NotebookItem) {
  const ui = useNotebookUI();
  const { perms } = ui;
  const canEdit = perms.canManageAll || item.nb_manage_by === perms.userId;
  const canReserve =
    perms.canReserve && item.nb_workflow === 'lead_queue' && !item.nb_manage_by && !item.nb_converted_at;
  const converted = !!item.nb_converted_at;
  const overdue = followInfo(item.nb_next_followup_date, item.nb_status).tone === 'overdue';
  return { ui, perms, canEdit, canReserve, converted, overdue };
}

function TableRow({ item, scope }: { item: NotebookItem; scope: Scope }) {
  const { ui, canEdit, canReserve, converted, overdue } = useRowState(item);
  return (
    <div
      className={cn(GRID, 'border-b px-5 transition-colors hover:bg-[#FBF8F4]')}
      style={{
        borderColor: '#F2EDE5',
        paddingTop: 16,
        paddingBottom: 16,
        background: overdue ? '#FFF8F6' : '#fff',
        boxShadow: overdue ? `inset 3px 0 0 ${FOLLOW.overdue.accent}` : undefined,
      }}
    >
      {/* customer */}
      <button
        type="button"
        onClick={() => ui.openDetail(item.id)}
        className="flex min-w-0 items-start gap-2.5 text-left"
      >
        <Avatar name={item.nb_customer_name} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14.5px] font-semibold">{item.nb_customer_name || '—'}</span>
            {item.nb_is_fresh_queue && (
              <span className="rounded-full px-1.5 py-px text-[11px] font-semibold" style={{ background: '#FBE3DF', color: '#B23A2B' }}>
                ใหม่จากคิว
              </span>
            )}
            {item.nb_is_online && (
              <span className="rounded-full px-1.5 py-px text-[11px] font-medium" style={{ background: '#E3EDF8', color: '#2C6BAE' }}>
                ออนไลน์
              </span>
            )}
          </div>
          <div className="text-ink-3 mt-0.5 text-[13px]">{item.nb_contact_person || 'ไม่ระบุผู้ติดต่อ'}</div>
          {item.nb_additional_info && (
            <div className="text-ink-4 mt-0.5 line-clamp-1 text-[12.5px]">{item.nb_additional_info}</div>
          )}
        </div>
      </button>

      {/* contact */}
      <div className="min-w-0 self-center">
        <div className="text-ink text-[14px] font-medium">{item.nb_contact_number || '—'}</div>
        {item.nb_email && <div className="text-ink-4 mt-0.5 truncate text-[12.5px]">{item.nb_email}</div>}
      </div>

      {/* status / action / follow */}
      <div className="self-center">
        <StatusChip status={item.nb_status} />
      </div>
      <div className="self-center">
        <ActionChip action={item.nb_action} />
      </div>
      <div className="self-center">
        <FollowChip date={item.nb_next_followup_date} status={item.nb_status} />
      </div>

      {/* actions */}
      <div className="flex items-center justify-end gap-1 self-center">
        <IconBtn title="ดูรายละเอียด" onClick={() => ui.openDetail(item.id)}>
          <Eye className="size-[18px]" />
        </IconBtn>
        {canReserve && scope === 'queue' && (
          <IconBtn title="รับลีดนี้" color="#1E7A45" onClick={() => ui.reserve(item)}>
            <HandHelping className="size-[18px]" />
          </IconBtn>
        )}
        {ui.perms.canAssign && scope === 'queue' && !item.nb_converted_at && (
          <IconBtn title="มอบหมายให้ฝ่ายขาย" color="#2C5FA8" onClick={() => ui.openAssign(item)}>
            <Users className="size-[18px]" />
          </IconBtn>
        )}
        {canEdit && (
          <IconBtn title="แก้ไข" onClick={() => ui.openEdit(item)}>
            <Pencil className="size-[17px]" />
          </IconBtn>
        )}
        {canEdit && !converted && (
          <IconBtn title="สร้างเป็นลูกค้า" color="#2A7A4C" onClick={() => ui.convert(item)}>
            <UserPlus className="size-[18px]" />
          </IconBtn>
        )}
        {ui.perms.canDelete && (
          <IconBtn title="ลบ" color="#C2554A" onClick={() => ui.openDelete(item)}>
            <Trash2 className="size-[17px]" />
          </IconBtn>
        )}
      </div>
    </div>
  );
}

function CardRow({ item, scope }: { item: NotebookItem; scope: Scope }) {
  const { ui, canEdit, canReserve, overdue } = useRowState(item);
  return (
    <div
      className="border-border rounded-2xl border bg-white p-4 shadow-sm"
      style={overdue ? { borderColor: '#F3C9C0' } : undefined}
    >
      <button type="button" onClick={() => ui.openDetail(item.id)} className="flex w-full items-start gap-2.5 text-left">
        <Avatar name={item.nb_customer_name} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{item.nb_customer_name || '—'}</div>
          <div className="text-ink-3 mt-0.5 text-[13px]">
            {item.nb_contact_person || 'ไม่ระบุ'} · {item.nb_contact_number || '—'}
          </div>
        </div>
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusChip status={item.nb_status} />
        <ActionChip action={item.nb_action} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: '#F0EBE3' }}>
        <FollowChip date={item.nb_next_followup_date} status={item.nb_status} />
        <div className="flex gap-0.5">
          <IconBtn title="ดู" onClick={() => ui.openDetail(item.id)}>
            <Eye className="size-[17px]" />
          </IconBtn>
          {canReserve && scope === 'queue' && (
            <IconBtn title="รับลีดนี้" color="#1E7A45" onClick={() => ui.reserve(item)}>
              <HandHelping className="size-[17px]" />
            </IconBtn>
          )}
          {canEdit && (
            <IconBtn title="แก้ไข" onClick={() => ui.openEdit(item)}>
              <Pencil className="size-[16px]" />
            </IconBtn>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  title,
  color,
  onClick,
  children,
}: {
  title: string;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex size-[34px] items-center justify-center rounded-[9px] hover:bg-[#F1EDE7]"
      style={{ color: color ?? '#6B655B' }}
    >
      {children}
    </button>
  );
}
