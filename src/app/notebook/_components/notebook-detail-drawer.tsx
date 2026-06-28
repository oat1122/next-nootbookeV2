'use client';

import { X, Pencil, UserPlus, CalendarDays } from 'lucide-react';
import { FOLLOW, followInfo, thaiDateTime } from '../_lib/notebook-display';
import { Avatar, StatusChip } from './chips';
import type { NotebookItem, NotebookPerms } from '../_lib/types';

type UserSummary = NotebookItem['manage_by_user'];

function userDisplay(u: UserSummary): string {
  if (!u) return '—';
  const full = `${u.user_firstname ?? ''} ${u.user_lastname ?? ''}`.trim();
  return u.username || u.user_nickname || (full !== '' ? full : String(u.user_id));
}

const HISTORY_LABEL: Record<string, string> = {
  created: 'จดบันทึกครั้งแรก',
  created_to_queue: 'สร้างลีดเข้าคิว',
  created_to_mine: 'สร้างลีด (ของฉัน)',
  updated: 'อัปเดตข้อมูล',
  customer_info_updated: 'แก้ไขข้อมูลลูกค้า',
  reserved: 'รับลีดเข้าดูแล',
  assigned: 'มอบหมายงาน',
  reassigned: 'เปลี่ยนผู้ดูแล',
  converted: 'สร้างเป็นลูกค้า',
  deleted: 'ลบรายการ',
};

const HISTORY_DOT: Record<string, string> = {
  created: '#C2B9AC',
  created_to_queue: '#C2B9AC',
  created_to_mine: '#C2B9AC',
  updated: '#5E45A8',
  customer_info_updated: '#5E45A8',
  reserved: '#3E86D6',
  assigned: '#3E86D6',
  reassigned: '#3E86D6',
  converted: '#27A35B',
  deleted: '#D5503D',
};

const FACT_ICON = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
  person: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6',
  source: 'M12 22s8-4.5 8-11.5A8 8 0 0 0 4 10.5C4 17.5 12 22 12 22Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
} as const;

/** drawer รายละเอียด + ไทม์ไลน์ประวัติ (ขวา) — ปุ่ม convert/edit/reserve ตามสิทธิ์ */
export function NotebookDetailDrawer({
  item,
  perms,
  onClose,
  onEdit,
  onConvert,
  onReserve,
}: {
  item: NotebookItem;
  perms: NotebookPerms;
  onClose: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onReserve: () => void;
}) {
  const canEdit = perms.canManageAll || item.nb_manage_by === perms.userId;
  const canReserve =
    perms.canReserve &&
    item.nb_workflow === 'lead_queue' &&
    !item.nb_manage_by &&
    !item.nb_converted_at;
  const converted = !!item.nb_converted_at;

  const f = followInfo(item.nb_next_followup_date, item.nb_status);
  const ft = FOLLOW[f.tone];

  const facts: { icon: string; label: string; value: string }[] = [
    { icon: FACT_ICON.phone, label: 'เบอร์โทร', value: item.nb_contact_number || '—' },
    { icon: FACT_ICON.person, label: 'ผู้ติดต่อ', value: item.nb_contact_person || '—' },
    { icon: FACT_ICON.mail, label: 'อีเมล', value: item.nb_email || '—' },
    { icon: FACT_ICON.source, label: 'แหล่งที่มา', value: item.nb_is_online ? 'ออนไลน์' : 'ออนไซต์' },
    { icon: FACT_ICON.user, label: 'ผู้ดูแล', value: userDisplay(item.manage_by_user) },
  ];

  const histories = item.histories ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className="fixed top-0 right-0 z-[41] h-screen w-[min(480px,94vw)] overflow-y-auto bg-background shadow-2xl"
        style={{ animation: 'nbSlideIn .26s ease' }}
      >
        {/* header */}
        <div className="border-border sticky top-0 z-[2] border-b bg-white px-6 py-5">
          <div className="flex items-start gap-3.5">
            <Avatar name={item.nb_customer_name} size={52} />
            <div className="min-w-0 flex-1">
              <div className="text-lg leading-snug font-bold">{item.nb_customer_name || '—'}</div>
              <div className="mt-1.5">
                <StatusChip status={item.nb_status} />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-2 flex size-9 items-center justify-center rounded-[10px]"
              style={{ background: '#F4F0EA' }}
            >
              <X className="size-[18px]" />
            </button>
          </div>
        </div>

        <div className="px-6 pt-5 pb-28">
          {/* followup highlight */}
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-[15px]"
            style={{ background: ft.bg, color: ft.fg }}
          >
            <CalendarDays className="size-5 shrink-0" />
            <div>
              <div className="text-xs font-semibold uppercase opacity-75">ติดตามครั้งหน้า</div>
              <div className="mt-0.5 text-[15px] font-bold">{f.label}</div>
              {item.nb_next_followup_note && (
                <div className="mt-0.5 text-[13px] opacity-85">{item.nb_next_followup_note}</div>
              )}
            </div>
          </div>

          {/* contact facts */}
          <div className="border-border mt-[18px] rounded-2xl border bg-white px-4 py-0.5">
            {facts.map((fct, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b py-[11px] last:border-0"
                style={{ borderColor: '#F4F0EA' }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-[18px] shrink-0"
                  fill="none"
                  stroke="#B0A89C"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={fct.icon} />
                </svg>
                <div className="text-ink-3 w-[78px] shrink-0 text-[12.5px]">{fct.label}</div>
                <div className="text-ink min-w-0 text-[14px] font-medium break-words">{fct.value}</div>
              </div>
            ))}
          </div>

          {/* conversation note */}
          {item.nb_additional_info && (
            <div className="mt-[18px]">
              <div className="text-ink-3 mb-2 text-[12.5px] font-semibold uppercase tracking-wide">
                บันทึกการพูดคุยล่าสุด
              </div>
              <div className="border-border text-ink rounded-2xl border bg-white px-4 py-4 text-[14px] leading-relaxed">
                {item.nb_additional_info}
              </div>
            </div>
          )}

          {/* history timeline */}
          <div className="mt-[18px]">
            <div className="text-ink-3 mb-2.5 text-[12.5px] font-semibold uppercase tracking-wide">
              ไทม์ไลน์ประวัติ
            </div>
            {histories.length === 0 ? (
              <div className="text-ink-4 text-[13px]">ยังไม่มีประวัติ</div>
            ) : (
              <div className="relative pl-1.5">
                {histories.map((h) => (
                  <div
                    key={h.id}
                    className="relative pb-4 pl-[22px]"
                    style={{ borderLeft: '2px solid #EAE4DB' }}
                  >
                    <span
                      className="absolute top-[3px] -left-[7px] size-3 rounded-full"
                      style={{
                        border: '2px solid #FAF7F3',
                        background: HISTORY_DOT[h.action ?? ''] ?? '#C2B9AC',
                      }}
                    />
                    <div className="text-ink text-[14px] font-semibold">
                      {HISTORY_LABEL[h.action ?? ''] ?? h.action ?? 'อัปเดต'}
                    </div>
                    <div className="text-ink-4 mt-0.5 text-[12px]">
                      {thaiDateTime(h.created_at)} · {userDisplay(h.action_by)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="border-border fixed bottom-0 right-0 flex w-[min(480px,94vw)] gap-2.5 border-t bg-white/95 px-6 py-4 backdrop-blur">
          {canReserve ? (
            <button
              type="button"
              onClick={onReserve}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[14.5px] font-semibold"
              style={{ border: '1px solid #CFE6D8', background: '#EAF6EE', color: '#1E7A45' }}
            >
              <UserPlus className="size-[18px]" />
              รับลีดนี้
            </button>
          ) : (
            canEdit &&
            !converted && (
              <button
                type="button"
                onClick={onConvert}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[14.5px] font-semibold"
                style={{ border: '1px solid #CFE6D8', background: '#EAF6EE', color: '#1E7A45' }}
              >
                <UserPlus className="size-[18px]" />
                สร้างเป็นลูกค้า
              </button>
            )
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[14.5px] font-semibold"
            >
              <Pencil className="size-[18px]" />
              บันทึกการติดตาม
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
