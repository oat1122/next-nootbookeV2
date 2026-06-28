/**
 * ค่าคงที่/ตัวช่วยแสดงผล — พอร์ตจากดีไซน์ Notebook.dc.html (STATUS/ACTION/FOLLOW/AVATAR + helpers)
 * client-safe (ไม่มี server-only) ใช้ร่วมทั้ง list / drawer / form / stat cards
 *
 * หมายเหตุ: nb_status / nb_action เก็บใน DB เป็น "คีย์ภาษาไทย" ด้านล่าง (free string) —
 * FE เป็นเจ้าของ vocabulary นี้ทั้งหมด
 */

export type StatusKey = 'พิจารณา' | 'ได้งาน' | 'หลุด' | 'ไม่ได้งาน' | 'ยังไม่มีแผนทำ';
export type ActionKey = 'โทร' | 'ส่งเมล์' | 'ได้เข้าพบ' | 'ลูกค้ามาพบ' | 'ส่งงานมา';

type StatusMeta = { label: string; bg: string; fg: string; dot: string };
type ActionMeta = { label: string; bg: string; fg: string };
type FollowMeta = { bg: string; fg: string; accent: string };

export const STATUS: Record<string, StatusMeta> = {
  พิจารณา: { label: 'กำลังพิจารณา', bg: '#FCEFD2', fg: '#97650A', dot: '#F2A60C' },
  ได้งาน: { label: 'ได้งานแล้ว', bg: '#DCF3E3', fg: '#1B7A45', dot: '#27A35B' },
  หลุด: { label: 'หลุดแล้ว', bg: '#FBE3DF', fg: '#B23A2B', dot: '#D5503D' },
  ไม่ได้งาน: { label: 'ไม่ได้งาน', bg: '#ECEAE5', fg: '#6B665E', dot: '#9A938A' },
  ยังไม่มีแผนทำ: { label: 'ยังไม่มีแผน', bg: '#DEEAF6', fg: '#2C6BAE', dot: '#3E86D6' },
};
export const STATUS_ORDER: StatusKey[] = ['พิจารณา', 'ได้งาน', 'ยังไม่มีแผนทำ', 'ไม่ได้งาน', 'หลุด'];

export const ACTION: Record<string, ActionMeta> = {
  โทร: { label: 'โทรหาลูกค้า', bg: '#E7EEF9', fg: '#2C5FA8' },
  ส่งเมล์: { label: 'ส่งอีเมล/โปรไฟล์', bg: '#EDE7F6', fg: '#5E45A8' },
  ได้เข้าพบ: { label: 'นัดเข้าพบ', bg: '#E3F1E8', fg: '#2A7A4C' },
  ลูกค้ามาพบ: { label: 'ลูกค้าเข้ามาพบ', bg: '#FBEEE0', fg: '#9A5B14' },
  ส่งงานมา: { label: 'ส่งงานให้แล้ว', bg: '#FDEAEA', fg: '#B23A45' },
};
export const ACTION_ORDER: ActionKey[] = ['โทร', 'ส่งเมล์', 'ได้เข้าพบ', 'ลูกค้ามาพบ', 'ส่งงานมา'];

export type FollowTone = 'overdue' | 'today' | 'soon' | 'upcoming' | 'none';
export const FOLLOW: Record<FollowTone, FollowMeta> = {
  overdue: { bg: '#FBE3DF', fg: '#B23A2B', accent: '#D5503D' },
  today: { bg: '#FCEFD2', fg: '#8A5A05', accent: '#F2A60C' },
  soon: { bg: '#FBF0DC', fg: '#9A6A00', accent: '#E8B23E' },
  upcoming: { bg: '#EAF1EC', fg: '#4C7159', accent: '#7FA98C' },
  none: { bg: '#F1EFEB', fg: '#9A938A', accent: '#D8D3CC' },
};

/** ไฮไลต์ลีดใหม่จากคิว (แท็บ "ลูกค้าของฉัน") — โทนเขียวอมฟ้า แยกจากแดง overdue / เขียว "ได้งาน" */
export const FRESH = { tint: '#F0FAF6', accent: '#1FA088', pillBg: '#D7F0E9', pillFg: '#176F5E' } as const;

const AVATAR: [string, string][] = [
  ['#F4E3DC', '#9A5B14'],
  ['#E3ECDD', '#3C7A55'],
  ['#E1E8F4', '#2C5FA8'],
  ['#F4ECD9', '#97650A'],
  ['#EDE2F0', '#7C4FA0'],
  ['#DDEDED', '#2E7D78'],
];

const CLOSED = new Set<string>(['ได้งาน', 'หลุด', 'ไม่ได้งาน']);

/** วันนี้โซน Asia/Bangkok 'YYYY-MM-DD' (ใช้เป็น default ของ followInfo ฝั่ง client) */
export function bangkokToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

/** ตัวย่อ avatar — ตัดคำนำหน้า แล้วเอา 2 ตัวแรก (พอร์ตจากดีไซน์) */
export function initials(name: string | null | undefined): string {
  const raw = (name ?? '').replace(/^(บริษัท|ร้าน|หจก\.|ห้าง|โรงเรียน|คลินิก|คุณ|หมอ)\s*/, '').trim();
  return (raw || name || '?').slice(0, 2);
}

/** คู่สี [bg, fg] ของ avatar — เลือกจากผลรวม charCode (เสถียรต่อชื่อเดียวกัน) */
export function avatarPair(name: string | null | undefined): [string, string] {
  const n = name ?? '';
  let s = 0;
  for (let i = 0; i < n.length; i++) s = (s + n.charCodeAt(i)) % AVATAR.length;
  return AVATAR[s];
}

/** สไตล์ avatar (inline) ขนาดยืดหยุ่น — สำหรับ chip เล็ก/dialog ที่ <Avatar> ไม่ครอบคลุม */
export function avatarStyle(name: string | null | undefined, size: number): React.CSSProperties {
  const [bg, fg] = avatarPair(name);
  return {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    borderRadius: size >= 36 ? 11 : 8,
    background: bg,
    color: fg,
    fontWeight: 600,
    fontSize: size >= 36 ? 14 : 11.5,
  };
}

/** จำนวนวัน a - b (ทั้งคู่ 'YYYY-MM-DD') */
function dayDiff(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00`);
  const db = Date.parse(`${b}T00:00:00`);
  return Math.round((da - db) / 86_400_000);
}

export type FollowInfo = { tone: FollowTone; label: string };

/** สถานะการติดตาม — พอร์ตจาก followInfo ของดีไซน์ (todayStr เริ่มต้น = วันนี้ Bangkok) */
export function followInfo(
  dateStr: string | null | undefined,
  status: string | null | undefined,
  todayStr: string = bangkokToday(),
): FollowInfo {
  if (status && CLOSED.has(status)) return { tone: 'none', label: 'ปิดดีลแล้ว' };
  if (!dateStr) return { tone: 'none', label: 'ยังไม่กำหนด' };
  const diff = dayDiff(dateStr, todayStr);
  if (diff < 0) return { tone: 'overdue', label: `เลยกำหนด ${-diff} วัน` };
  if (diff === 0) return { tone: 'today', label: 'ครบกำหนดวันนี้' };
  if (diff === 1) return { tone: 'soon', label: 'พรุ่งนี้' };
  if (diff <= 3) return { tone: 'soon', label: `อีก ${diff} วัน` };
  return { tone: 'upcoming', label: `อีก ${diff} วัน` };
}

/** เวลารอในคิวกลาง (จาก created_at) — เขียว=เข้าใหม่วันนี้, กลาง=รอ 1-2 วัน, แดง=รอเกิน 2 วัน */
export function queueWaitInfo(
  createdAtIso: string | null | undefined,
  todayStr: string = bangkokToday(),
): { bg: string; fg: string; label: string } {
  if (!createdAtIso) return { bg: '#EAF7EE', fg: '#1B7A45', label: 'เข้าใหม่วันนี้' };
  const created = new Date(createdAtIso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const d = dayDiff(todayStr, created);
  if (d <= 0) return { bg: '#EAF7EE', fg: '#1B7A45', label: 'เข้าใหม่วันนี้' };
  if (d <= 2) return { bg: '#F4F0EA', fg: '#5C564D', label: `รอ ${d} วัน` };
  return { bg: '#FBE3DF', fg: '#B23A2B', label: `รอ ${d} วัน` };
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** วันที่ไทยแบบสั้น 'D MMM พ.ศ.' (รับ 'YYYY-MM-DD' หรือ ISO datetime) */
export function thaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** วันที่+เวลาไทยแบบสั้น สำหรับ timeline (รับ ISO) */
export function thaiDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${thaiDate(iso)} · ${hh}:${mm}`;
}

/** badge แบบ inline-style (chip) ตามสีของดีไซน์ */
export function chipStyle(bg: string, fg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 11px',
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 12.5,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

export function dotStyle(color: string): React.CSSProperties {
  return { width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 };
}

export function statusMeta(key: string | null | undefined): StatusMeta {
  return (key && STATUS[key]) || STATUS['พิจารณา'];
}
