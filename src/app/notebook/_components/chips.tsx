import {
  ACTION,
  FOLLOW,
  FRESH,
  avatarPair,
  chipStyle,
  dotStyle,
  followInfo,
  initials,
  queueWaitInfo,
  statusMeta,
} from '../_lib/notebook-display';

/** avatar กลม/มน พร้อมตัวย่อ + สีคงที่ตามชื่อ */
export function Avatar({ name, size = 40 }: { name: string | null | undefined; size?: number }) {
  const [bg, fg] = avatarPair(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 50 ? 14 : 11,
        background: bg,
        color: fg,
        fontSize: size >= 50 ? 19 : 15,
      }}
    >
      {initials(name)}
    </div>
  );
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  const m = statusMeta(status);
  return (
    <span style={chipStyle(m.bg, m.fg)}>
      <span style={dotStyle(m.dot)} />
      {m.label}
    </span>
  );
}

/** ป้าย "ใหม่จากคิว" — ลีดที่เพิ่งรับจากคิวกลางแต่ยังไม่กรอกสถานะ/ติดตาม (ใช้ทั้งตาราง+การ์ด) */
export function FreshQueueBadge() {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[11px] font-semibold"
      style={{ background: FRESH.pillBg, color: FRESH.pillFg }}
    >
      ใหม่จากคิว
    </span>
  );
}

export function ActionChip({ action }: { action: string | null | undefined }) {
  const a = action ? ACTION[action] : undefined;
  return <span style={chipStyle(a?.bg ?? '#F0EEEA', a?.fg ?? '#8A847C')}>{a?.label ?? 'ยังไม่กำหนด'}</span>;
}

export function FollowChip({
  date,
  status,
}: {
  date: string | null | undefined;
  status: string | null | undefined;
}) {
  const f = followInfo(date, status);
  const ft = FOLLOW[f.tone];
  return <span style={chipStyle(ft.bg, ft.fg)}>{f.label}</span>;
}

/** ป้าย "เข้าคิวเมื่อ" — เวลารอในคิวกลาง คำนวณจาก created_at (ใช้แทน FollowChip ในแท็บคิวกลาง) */
export function QueueWaitChip({ createdAt }: { createdAt: string | null | undefined }) {
  const w = queueWaitInfo(createdAt);
  return <span style={chipStyle(w.bg, w.fg)}>{w.label}</span>;
}
