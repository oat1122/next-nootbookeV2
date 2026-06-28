import {
  ACTION,
  FOLLOW,
  avatarPair,
  chipStyle,
  dotStyle,
  followInfo,
  initials,
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
