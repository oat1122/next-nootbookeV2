'use client';

import { Eye, Pencil, Phone, UserPlus, Trash2, NotebookPen, HandHelping, X } from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { rise, riseStagger } from '../_lib/motion';
import { FOLLOW, FRESH, avatarStyle, followInfo, initials } from '../_lib/notebook-display';
import { Avatar, StatusChip, ActionChip, FollowChip, FreshQueueBadge, QueueWaitChip } from './chips';
import { useNotebookUI } from './notebook-ui';
import type { NotebookItem, Scope, ViewMode } from '../_lib/types';

// คลาส grid ต้องเขียนเต็มเป็น literal (Tailwind JIT สแกนจาก source ตรง ๆ)
const GRID = 'grid grid-cols-[2.4fr_1.5fr_1.2fr_1.4fr_1.5fr_1.3fr] gap-2';
const GRID_SEL = 'grid grid-cols-[auto_2.4fr_1.5fr_1.2fr_1.4fr_1.5fr_1.3fr] gap-2';

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
        {notebooks.map((n, i) => (
          <CardRow key={n.id} item={n} scope={scope} index={i} />
        ))}
      </div>
    );
  }

  // เลือกหลายรายการเพื่อมอบหมายพร้อมกัน — เฉพาะตาราง + คิวกลาง + ผู้มีสิทธิ์รับ/มอบหมาย
  const selectable = scope === 'queue' && (ui.perms.canReserve || ui.perms.canAssign);
  const g = selectable ? GRID_SEL : GRID;
  const allSelected = selectable && notebooks.every((n) => ui.selected.has(n.id));
  const selItems = selectable ? notebooks.filter((n) => ui.selected.has(n.id)) : [];

  return (
    <>
      <div className="border-border overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className={cn(g, 'text-ink-3 border-border border-b bg-[#FBF8F3] px-5 py-3.5 text-[12.5px] font-semibold')}>
          {selectable && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  allSelected ? ui.clearSelection() : ui.selectAll(notebooks.map((n) => n.id))
                }
                className="accent-primary size-4 cursor-pointer"
                aria-label="เลือกทั้งหมด"
              />
            </div>
          )}
          <div>ลูกค้า / ลีด</div>
          <div>ติดต่อ</div>
          <div>สถานะ</div>
          <div>ขั้นตอนถัดไป</div>
          <div>{scope === 'queue' ? 'เข้าคิวเมื่อ' : 'ติดตามครั้งหน้า'}</div>
          <div className="text-right">จัดการ</div>
        </div>
        {notebooks.map((n, i) => (
          <TableRow
            key={n.id}
            item={n}
            scope={scope}
            selectable={selectable}
            gridClass={g}
            index={i}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectable && selItems.length > 0 && (
          <m.div
            key="sel-bar"
            initial={{ opacity: 0, x: '-50%', y: 24 }}
            animate={{ opacity: 1, x: '-50%', y: 0 }}
            exit={{ opacity: 0, x: '-50%', y: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 z-40"
            style={{ width: 'min(1180px, calc(100% - 48px))' }}
          >
          <div
            className="border-border flex items-center gap-4 rounded-[18px] border bg-white py-3 pr-3.5 pl-[18px]"
            style={{ boxShadow: '0 18px 44px rgba(40,30,20,.16), 0 4px 12px rgba(40,30,20,.08)' }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex shrink-0 flex-col leading-tight">
                <span className="num text-[20px] font-bold" style={{ color: '#e1543b' }}>
                  {selItems.length}
                </span>
                <span className="text-[11.5px] font-semibold" style={{ color: '#857e74' }}>
                  เลือกไว้
                </span>
              </div>
              <div className="h-[34px] w-px shrink-0" style={{ background: '#ece7df' }} />
              <div className="flex min-w-0 items-center gap-2 overflow-x-auto py-0.5">
                {selItems.map((it) => (
                  <div
                    key={it.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1"
                    style={{ background: '#faf7f3', borderColor: '#ece7df' }}
                  >
                    <span style={avatarStyle(it.nb_customer_name, 24)}>
                      {initials(it.nb_customer_name)}
                    </span>
                    <span className="text-[13px] font-medium whitespace-nowrap">
                      {it.nb_customer_name || '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => ui.toggleSelect(it.id)}
                      aria-label="เอาออก"
                      className="flex size-[18px] shrink-0 items-center justify-center rounded-full"
                      style={{ background: '#ece7df', color: '#857e74' }}
                    >
                      <X className="size-[11px]" strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={ui.clearSelection}
                className="border-border text-ink-2 hover:bg-surface-2 rounded-xl border bg-white px-4 py-2.5 text-[13.5px] font-semibold"
              >
                ล้าง
              </button>
              <button
                type="button"
                onClick={ui.openAssignSelected}
                className="text-primary-foreground inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold"
                style={{ background: '#e1543b', boxShadow: '0 2px 8px rgba(225,84,59,.3)' }}
              >
                <UserPlus className="size-4" />
                มอบหมาย {selItems.length} รายการ
              </button>
            </div>
          </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

function useRowState(item: NotebookItem, scope: Scope) {
  const ui = useNotebookUI();
  const { perms } = ui;
  const canEdit = perms.canManageAll || item.nb_manage_by === perms.userId;
  // คิวกลางที่ยังว่าง + ยังไม่ปิดดีล → กด "รับลีดนี้" เปิด dialog (รับเอง/มอบให้คนอื่น)
  const canQueueAssign =
    (perms.canReserve || perms.canAssign) &&
    item.nb_workflow === 'lead_queue' &&
    !item.nb_manage_by &&
    !item.nb_converted_at;
  const converted = !!item.nb_converted_at;
  const overdue = followInfo(item.nb_next_followup_date, item.nb_status).tone === 'overdue';
  // ลีดใหม่จากคิว — เน้นบนแท็บ "ลูกค้าของฉัน" + "ทั้งหมด" (ไม่โชว์บน "คิวกลาง": ทั้งแท็บคือคิวอยู่แล้ว
  // และลีดในคิวยังไม่มีเจ้าของ → derive ไม่ fresh อยู่แล้ว) บอก sales ว่ามีลีดใหม่ต้องรีบโทร
  const fresh = item.nb_is_fresh_queue && scope !== 'queue';
  return { ui, perms, canEdit, canQueueAssign, converted, overdue, fresh };
}

function TableRow({
  item,
  scope,
  selectable,
  gridClass,
  index,
}: {
  item: NotebookItem;
  scope: Scope;
  selectable: boolean;
  gridClass: string;
  index: number;
}) {
  const { ui, canEdit, canQueueAssign, converted, overdue, fresh } = useRowState(item, scope);
  return (
    <m.div
      initial={rise.initial}
      animate={rise.animate}
      transition={riseStagger(index)}
      className={cn(gridClass, 'border-b px-5 transition-colors hover:bg-[#FBF8F4]')}
      style={{
        borderColor: '#F2EDE5',
        paddingTop: 16,
        paddingBottom: 16,
        background: fresh ? FRESH.tint : overdue ? '#FFF8F6' : '#fff',
        boxShadow: fresh
          ? `inset 3px 0 0 ${FRESH.accent}`
          : overdue
            ? `inset 3px 0 0 ${FOLLOW.overdue.accent}`
            : undefined,
      }}
    >
      {selectable && (
        <div className="flex items-center self-center">
          <input
            type="checkbox"
            checked={ui.selected.has(item.id)}
            onChange={() => ui.toggleSelect(item.id)}
            className="accent-primary size-4 cursor-pointer"
            aria-label="เลือกลีดนี้"
          />
        </div>
      )}

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
            {fresh && <FreshQueueBadge />}
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
        {scope === 'queue' ? (
          <QueueWaitChip createdAt={item.created_at} />
        ) : (
          <FollowChip date={item.nb_next_followup_date} status={item.nb_status} />
        )}
      </div>

      {/* actions */}
      <div className="flex items-center justify-end gap-1 self-center">
        {canQueueAssign && scope === 'queue' && (
          <button
            type="button"
            onClick={() => ui.openAssign([item])}
            className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap"
            style={{ borderColor: '#BFE3CD', background: '#EAF7EE', color: '#1B7A45' }}
          >
            <HandHelping className="size-[15px]" />
            รับลีดนี้
          </button>
        )}
        <IconBtn title="ดูรายละเอียด" onClick={() => ui.openDetail(item.id)}>
          <Eye className="size-[18px]" />
        </IconBtn>
        {scope === 'mine' && canEdit && item.nb_contact_number && (
          <IconBtn title="โทรหาลูกค้า" color="#2C5FA8" onClick={() => ui.call(item)}>
            <Phone className="size-[17px]" />
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
    </m.div>
  );
}

function CardRow({ item, scope, index }: { item: NotebookItem; scope: Scope; index: number }) {
  const { ui, canEdit, canQueueAssign, overdue, fresh } = useRowState(item, scope);
  return (
    <m.div
      initial={rise.initial}
      animate={rise.animate}
      transition={riseStagger(index)}
      className="border-border rounded-2xl border bg-white p-4 shadow-sm"
      style={
        fresh
          ? { borderColor: FRESH.accent, background: FRESH.tint }
          : overdue
            ? { borderColor: '#F3C9C0' }
            : undefined
      }
    >
      <button type="button" onClick={() => ui.openDetail(item.id)} className="flex w-full items-start gap-2.5 text-left">
        <Avatar name={item.nb_customer_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold">{item.nb_customer_name || '—'}</span>
            {fresh && <FreshQueueBadge />}
          </div>
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
          {canQueueAssign && scope === 'queue' && (
            <IconBtn title="รับลีดนี้" color="#1E7A45" onClick={() => ui.openAssign([item])}>
              <HandHelping className="size-[17px]" />
            </IconBtn>
          )}
          {scope === 'mine' && canEdit && item.nb_contact_number && (
            <IconBtn title="โทรหาลูกค้า" color="#2C5FA8" onClick={() => ui.call(item)}>
              <Phone className="size-[16px]" />
            </IconBtn>
          )}
          {canEdit && (
            <IconBtn title="แก้ไข" onClick={() => ui.openEdit(item)}>
              <Pencil className="size-[16px]" />
            </IconBtn>
          )}
        </div>
      </div>
    </m.div>
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
