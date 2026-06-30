import 'server-only';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { statusMeta, thaiDate, ACTION } from '@/app/notebook/_lib/notebook-display';
import { registerPdfFonts } from './fonts';

registerPdfFonts();

/**
 * เทมเพลต PDF ของหน้า /notebook/report — พอร์ตจากดีไซน์ "Notebook PDF.dc.html" (A4 แนวนอน)
 * - StandardReportDoc: ตารางกิจกรรม (จาก KPI details) จัดกลุ่มตามวัน
 * - SelfReportDoc: หน้า 1 Lead Intake Summary + ตาราง lead / หน้า 2 Daily Activity + Recall
 * helper จัดกลุ่ม/แปลงสถานะแยกเป็น pure function (เทสได้ใน report-pdf.test.ts)
 */

// ── โทนสีจากดีไซน์ ──────────────────────────────────────────────────────────
const C = {
  ink: '#23262f',
  body: '#5c564d',
  muted: '#857e74',
  faint: '#a8a29a',
  accent: '#e1543b',
  hair: '#f4f0ea',
  hair2: '#e6e0d7',
  groupBg: '#f4f0ea',
  cardBg: '#fffdfb',
  cardBorder: '#ece7df',
  footHair: '#f0ebe3',
  recallBar: '#f0c98a',
  recallBg: '#fdf8ef',
  personalBar: '#d8b5ac',
  personalBg: '#fbf3f1',
  transferBar: '#a9c4ea',
  transferBg: '#f1f6fc',
  transferFg: '#2f5fa8',
} as const;
const THAI = 'IBM Plex Sans Thai';
const MONO = 'IBM Plex Mono';

// ── input types (subset ของผลลัพธ์ query — โครงสร้างเข้ากันได้แบบ structural) ──
export type StdDetailInput = {
  nb_customer_name: string;
  nb_contact_number: string | null;
  nb_status: string | null;
  nb_additional_info: string | null;
  nb_remarks: string | null;
  nb_action: string | null;
  action_type: 'created' | 'updated';
  created_at: string | null;
};
export type ActivityInput = {
  nb_customer_name: string | null;
  nb_is_online: boolean | null;
  nb_contact_person: string | null;
  nb_contact_number: string | null;
  nb_email: string | null;
  nb_additional_info: string | null;
  nb_action: string | null;
  nb_status: string | null;
  nb_remarks: string | null;
  nb_date: string | null;
  nb_time: string | null;
  nb_entry_type: string | null;
  created_at: string | null;
};
export type LeadInput = {
  nb_customer_name: string | null;
  nb_contact_person: string | null;
  nb_contact_number: string | null;
  nb_status: string | null;
  nb_manage_by: number | null;
  nb_converted_at: string | null;
  created_at: string | null;
};
export type RecallInput = {
  customer_name: string;
  recall_note: string | null;
  was_overdue: boolean | null;
  days_overdue: number | null;
  created_at: string | null;
};
export type TransferInput = {
  customer_name: string;
  to_user_name: string;
  is_reassign: boolean | null;
  created_at: string | null;
};

type ActivityRow = {
  time: string;
  customer: string;
  online?: boolean;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  activity?: string | null;
  activitySub?: string | null;
  status?: string | null;
  remark?: string | null;
  personal?: boolean;
};
type DayGroup = { dateKey: string; created: number; updated: number; rows: ActivityRow[] };

// ── pure helpers ────────────────────────────────────────────────────────────
const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'HH.mm' จาก datetime (รับ 'YYYY-MM-DD HH:mm:ss' หรือ ISO) */
export function timeFromDateLike(s: string | null | undefined): string {
  const d = toDate(s);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' สำหรับใช้เป็น key จัดกลุ่มตามวัน */
export function dayKey(s: string | null | undefined): string {
  if (s && s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);
  const d = toDate(s);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function thaiWeekday(key: string): string {
  const d = toDate(key);
  return d ? WEEKDAYS[d.getDay()] : '';
}

/** สถานะของ lead ในคิว (พอร์ตป้าย Claimed / In Central Queue / เป็นลูกค้า ของดีไซน์) */
export function leadStatePill(nb: Pick<LeadInput, 'nb_manage_by' | 'nb_converted_at'>): {
  label: string;
  bg: string;
  fg: string;
} {
  if (nb.nb_converted_at) return { label: 'เป็นลูกค้าแล้ว', bg: '#DCF3E3', fg: '#1B7A45' };
  if (nb.nb_manage_by != null) return { label: 'รับงานแล้ว', bg: '#e9f6ee', fg: '#15803d' };
  return { label: 'อยู่ในคิวกลาง', bg: C.hair, fg: C.muted };
}

/** จัดกลุ่มตามวัน เรียงวันใหม่→เก่า (คงลำดับ row เดิมภายในวัน) */
export function groupByDay<T>(rows: T[], getKey: (r: T) => string): { key: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = getKey(r) || '—';
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, rows]) => ({ key, rows }));
}

/** KPI details → day groups สำหรับ Standard Report */
export function buildStandardGroups(details: StdDetailInput[]): DayGroup[] {
  return groupByDay(details, (d) => dayKey(d.created_at)).map(({ key, rows }) => ({
    dateKey: key,
    created: rows.filter((r) => r.action_type === 'created').length,
    updated: rows.filter((r) => r.action_type !== 'created').length,
    rows: rows.map((d) => ({
      time: timeFromDateLike(d.created_at),
      customer: d.nb_customer_name,
      phone: d.nb_contact_number,
      activity: d.nb_additional_info || (d.nb_action ? ACTION[d.nb_action]?.label : null) || null,
      activitySub: d.action_type === 'created' ? 'จดใหม่' : (d.nb_action ? ACTION[d.nb_action]?.label : null) || 'อัปเดต',
      status: d.nb_status,
      remark: d.nb_remarks,
    })),
  }));
}

/** activity notebooks → day groups สำหรับ Self Report หน้า 2 */
export function buildActivityGroups(items: ActivityInput[]): DayGroup[] {
  return groupByDay(items, (n) => dayKey(n.nb_date || n.created_at)).map(({ key, rows }) => ({
    dateKey: key,
    created: 0,
    updated: 0,
    rows: rows.map((n) => ({
      time: n.nb_time?.trim() || timeFromDateLike(n.created_at),
      customer: n.nb_customer_name || '—',
      online: !!n.nb_is_online,
      contactPerson: n.nb_contact_person,
      phone: n.nb_contact_number,
      email: n.nb_email,
      activity: n.nb_additional_info || (n.nb_action ? ACTION[n.nb_action]?.label : null) || null,
      activitySub: n.nb_action ? ACTION[n.nb_action]?.label : null,
      status: n.nb_status,
      remark: n.nb_remarks,
      personal: n.nb_entry_type === 'personal_activity',
    })),
  }));
}

// ── primitives ──────────────────────────────────────────────────────────────
const COLS = [
  { w: 34 }, // เวลา (fixed)
  { f: 2.3 }, // ลูกค้า / ผู้ติดต่อ
  { f: 1.5 }, // ติดต่อ
  { f: 2.65 }, // กิจกรรม / การกระทำ
  { f: 1.55 }, // สถานะ
  { f: 1.35 }, // หมายเหตุ
] as const;
function col(i: number) {
  const c = COLS[i];
  return 'w' in c ? { width: c.w, paddingRight: 6 } : { flexGrow: c.f, flexBasis: 0, flexShrink: 1, paddingRight: 8 };
}

function StatusPill({ statusKey }: { statusKey: string | null | undefined }) {
  if (!statusKey) return <Text style={{ fontSize: 8.5, color: C.faint }}>—</Text>;
  const m = statusMeta(statusKey);
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: m.bg, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8 }}>
      <Text style={{ fontSize: 8, fontWeight: 600, color: m.fg }}>{m.label}</Text>
    </View>
  );
}

function Header({ title, subtitle, rangeLabel, printedAt, printedBy }: {
  title: string;
  subtitle: string;
  rangeLabel: string;
  printedAt: string;
  printedBy: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1.6, borderBottomColor: C.accent, paddingBottom: 9, marginBottom: 14 }}>
      <View>
        <Text style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{title}</Text>
        <Text style={{ fontSize: 8.5, color: C.faint, marginTop: 2, letterSpacing: 0.3 }}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 8.5, color: C.muted }}>
          ช่วงเวลา: <Text style={{ color: C.ink, fontWeight: 600 }}>{rangeLabel}</Text>
        </Text>
        <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 3 }}>พิมพ์เมื่อ: {printedAt} · โดย: {printedBy}</Text>
      </View>
    </View>
  );
}

function Footer({ label }: { label: string }) {
  return (
    <View fixed style={{ position: 'absolute', left: 34, right: 34, bottom: 18, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.footHair, paddingTop: 6 }}>
      <Text style={{ fontSize: 7.5, color: C.faint }}>{label}</Text>
      <Text style={{ fontSize: 7.5, color: C.faint }} render={({ pageNumber, totalPages }) => `หน้า ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function ColHeader() {
  const labels = ['เวลา', 'ลูกค้า / ผู้ติดต่อ', 'ติดต่อ', 'กิจกรรม / การกระทำ', 'สถานะ', 'หมายเหตุ'];
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1.2, borderBottomColor: C.hair2, paddingBottom: 5, paddingHorizontal: 4 }}>
      {labels.map((l, i) => (
        <Text key={l} style={{ ...col(i), fontSize: 7.5, fontWeight: 600, letterSpacing: 0.4, color: C.faint, textTransform: 'uppercase' }}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function GroupHeader({ g }: { g: DayGroup }) {
  const showCounts = g.created > 0 || g.updated > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: C.groupBg, borderLeftWidth: 3, borderLeftColor: C.accent, borderRadius: 4 }} wrap={false}>
      <Text style={{ fontSize: 10, fontWeight: 700, color: C.ink }}>{thaiDate(g.dateKey) || g.dateKey}</Text>
      <Text style={{ fontSize: 8.5, color: C.faint, marginLeft: 8 }}>{thaiWeekday(g.dateKey)}</Text>
      <View style={{ flexGrow: 1 }} />
      {showCounts && (
        <Text style={{ fontSize: 8.5, color: C.muted, marginRight: 10 }}>
          จดใหม่ <Text style={{ fontFamily: MONO, color: C.ink }}>{g.created}</Text>  ·  อัปเดต{' '}
          <Text style={{ fontFamily: MONO, color: C.ink }}>{g.updated}</Text>
        </Text>
      )}
      <View style={{ backgroundColor: '#fceeea', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 9 }}>
        <Text style={{ fontSize: 8.5, fontWeight: 600, color: C.accent }}>รวม {g.rows.length} ราย</Text>
      </View>
    </View>
  );
}

function ActivityRowView({ r }: { r: ActivityRow }) {
  if (r.personal) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: C.hair, borderLeftWidth: 3, borderLeftColor: C.personalBar, backgroundColor: C.personalBg, paddingVertical: 5, paddingLeft: 9, paddingRight: 6 }} wrap={false}>
        <View style={{ backgroundColor: '#f4ddd6', borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 }}>
          <Text style={{ fontSize: 7.5, fontWeight: 700, color: '#a85a48', letterSpacing: 0.3 }}>ธุระส่วนตัว</Text>
        </View>
        <Text style={{ fontSize: 9, color: '#8a6358', marginLeft: 8 }}>{r.activity || '—'}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 0.5, borderBottomColor: C.hair, paddingVertical: 6, paddingHorizontal: 4 }} wrap={false}>
      <Text style={{ ...col(0), fontFamily: MONO, fontSize: 8.5, color: C.muted }}>{r.time}</Text>
      <View style={col(1)}>
        <Text style={{ fontSize: 9, fontWeight: 600, color: C.ink }}>
          {r.customer}
          {r.online ? <Text style={{ fontSize: 7.5, fontWeight: 600, color: '#3f3f8a' }}>  ออนไลน์</Text> : null}
        </Text>
        {r.contactPerson ? <Text style={{ fontSize: 8, color: C.muted, marginTop: 1.5 }}>{r.contactPerson}</Text> : null}
      </View>
      <View style={col(2)}>
        {r.phone ? <Text style={{ fontFamily: MONO, fontSize: 8.5, color: C.ink }}>{r.phone}</Text> : <Text style={{ fontSize: 8.5, color: C.faint }}>—</Text>}
        {r.email ? <Text style={{ fontSize: 7.5, color: C.faint, marginTop: 1.5 }}>{r.email}</Text> : null}
      </View>
      <View style={col(3)}>
        <Text style={{ fontSize: 9, fontWeight: 500, color: C.ink, lineHeight: 1.35 }}>{r.activity || '—'}</Text>
        {r.activitySub ? <Text style={{ fontSize: 8, color: C.muted, marginTop: 1.5 }}>{r.activitySub}</Text> : null}
      </View>
      <View style={col(4)}>
        <StatusPill statusKey={r.status} />
      </View>
      <Text style={{ ...col(5), fontSize: 8, color: C.body, lineHeight: 1.35 }}>{r.remark || '—'}</Text>
    </View>
  );
}

function ActivityTable({ groups }: { groups: DayGroup[] }) {
  if (groups.length === 0) return <EmptyState />;
  return (
    <View>
      <ColHeader />
      {groups.map((g) => (
        <View key={g.dateKey}>
          <GroupHeader g={g} />
          {g.rows.map((r, i) => (
            <ActivityRowView key={i} r={r} />
          ))}
        </View>
      ))}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: C.faint }}>ไม่มีข้อมูลในช่วงนี้</Text>
    </View>
  );
}

const PAGE = { paddingTop: 30, paddingHorizontal: 34, paddingBottom: 40, fontFamily: THAI, color: C.ink, backgroundColor: '#ffffff' } as const;

// ── Standard Report ─────────────────────────────────────────────────────────
export function StandardReportDoc({ rangeLabel, printedAt, printedBy, groups }: {
  rangeLabel: string;
  printedAt: string;
  printedBy: string;
  groups: DayGroup[];
}) {
  return (
    <Document title="รายงานสมุดจดบันทึก">
      <Page size="A4" orientation="landscape" style={PAGE}>
        <Header title="รายงานสมุดจดบันทึก" subtitle="NOTEBOOK ACTIVITY REPORT" rangeLabel={rangeLabel} printedAt={printedAt} printedBy={printedBy} />
        <ActivityTable groups={groups} />
        <Footer label="รายงานสมุดจดบันทึก · TNP" />
      </Page>
    </Document>
  );
}

// ── Self Report ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, accent, big }: { label: string; value: string; accent?: string; big?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: C.cardBg }}>
      <Text style={{ fontSize: 8, color: C.faint, marginBottom: 5 }}>{label}</Text>
      <Text style={{ fontSize: big ? 17 : 12, fontWeight: 700, color: accent ?? C.ink, fontFamily: big ? MONO : THAI }}>{value}</Text>
    </View>
  );
}

function LeadTable({ leads }: { leads: LeadInput[] }) {
  const W = [{ f: 1.6 }, { f: 2.4 }, { f: 1.6 }, { f: 1.4 }, { f: 1.4 }] as const;
  const lc = (i: number) => ({ flexGrow: W[i].f, flexBasis: 0, flexShrink: 1, paddingRight: 8 });
  const heads = ['วันที่เพิ่มเข้า queue', 'ลูกค้า', 'ผู้ติดต่อ', 'เบอร์โทร', 'สถานะ'];
  return (
    <View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1.2, borderBottomColor: C.hair2, paddingBottom: 5, paddingHorizontal: 4 }}>
        {heads.map((h, i) => (
          <Text key={h} style={{ ...lc(i), fontSize: 7.5, fontWeight: 600, letterSpacing: 0.4, color: C.faint, textTransform: 'uppercase' }}>{h}</Text>
        ))}
      </View>
      {leads.length === 0 ? (
        <EmptyState />
      ) : (
        leads.map((l, i) => {
          const pill = leadStatePill(l);
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: C.hair, paddingVertical: 7, paddingHorizontal: 4 }} wrap={false}>
              <Text style={{ ...lc(0), fontFamily: MONO, fontSize: 8.5, color: C.muted }}>
                {dayKey(l.created_at) ? `${thaiDate(l.created_at)} ${timeFromDateLike(l.created_at)}` : '—'}
              </Text>
              <Text style={{ ...lc(1), fontSize: 9, fontWeight: 600, color: C.ink }}>{l.nb_customer_name || '—'}</Text>
              <Text style={{ ...lc(2), fontSize: 8.5, color: C.body }}>{l.nb_contact_person || '—'}</Text>
              <Text style={{ ...lc(3), fontFamily: MONO, fontSize: 8.5, color: C.ink }}>{l.nb_contact_number || '—'}</Text>
              <View style={lc(4)}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: pill.bg, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8 }}>
                  <Text style={{ fontSize: 8, fontWeight: 600, color: pill.fg }}>{pill.label}</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function RecallSection({ recalls }: { recalls: RecallInput[] }) {
  if (recalls.length === 0) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 6 }}>รายการ Recall</Text>
      {recalls.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 0.5, borderBottomColor: C.hair, borderLeftWidth: 3, borderLeftColor: C.recallBar, backgroundColor: C.recallBg, paddingVertical: 6, paddingLeft: 9, paddingRight: 6 }} wrap={false}>
          <Text style={{ width: 90, fontFamily: MONO, fontSize: 8, color: C.muted }}>{thaiDate(r.created_at) || '—'}</Text>
          <Text style={{ flexGrow: 1, flexBasis: 0, fontSize: 9, fontWeight: 600, color: C.ink, paddingRight: 8 }}>{r.customer_name}</Text>
          <Text style={{ flexGrow: 1.4, flexBasis: 0, fontSize: 8.5, color: C.body, paddingRight: 8 }}>{r.recall_note || '—'}</Text>
          <View style={{ width: 80 }}>
            {r.was_overdue ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: '#fbf1e2', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 8, fontWeight: 600, color: '#b45309' }}>เลย {r.days_overdue ?? 0} วัน</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 8, color: C.faint }}>ตามนัด</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** log การโอนลีดให้ฝ่ายขายอื่น (assigned/reassigned ที่ผู้ส่งออกทำเอง) */
function TransferSection({ transfers }: { transfers: TransferInput[] }) {
  if (transfers.length === 0) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 6 }}>การโอนลูกค้าให้ฝ่ายขายอื่น</Text>
      {transfers.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: C.hair, borderLeftWidth: 3, borderLeftColor: C.transferBar, backgroundColor: C.transferBg, paddingVertical: 6, paddingLeft: 9, paddingRight: 6 }} wrap={false}>
          <Text style={{ width: 112, fontFamily: MONO, fontSize: 8, color: C.muted }}>
            {dayKey(t.created_at) ? `${thaiDate(t.created_at)} ${timeFromDateLike(t.created_at)}` : '—'}
          </Text>
          <Text style={{ flexGrow: 1, flexBasis: 0, fontSize: 9, fontWeight: 600, color: C.ink, paddingRight: 6 }}>{t.customer_name}</Text>
          <Text style={{ width: 14, fontSize: 9, color: C.faint }}>→</Text>
          <Text style={{ flexGrow: 1, flexBasis: 0, fontSize: 9, fontWeight: 600, color: C.transferFg, paddingRight: 8 }}>{t.to_user_name}</Text>
          <View style={{ width: 76 }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#e8effb', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 8, fontWeight: 600, color: C.transferFg }}>{t.is_reassign ? 'เปลี่ยนผู้ดูแล' : 'มอบหมาย'}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function SelfReportDoc({ rangeLabel, rangeShort, printedAt, printedBy, leads, recalls, transfers, activityGroups }: {
  rangeLabel: string;
  rangeShort: string;
  printedAt: string;
  printedBy: string;
  leads: LeadInput[];
  recalls: RecallInput[];
  transfers: TransferInput[];
  activityGroups: DayGroup[];
}) {
  return (
    <Document title="Notebook Self Report">
      {/* หน้า 1 — Lead Intake Summary */}
      <Page size="A4" orientation="landscape" style={PAGE}>
        <Header title="Notebook Self Report" subtitle="รายงานสรุปงานส่วนตัว" rangeLabel={rangeLabel} printedAt={printedAt} printedBy={printedBy} />

        <Text style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Lead Intake Summary</Text>
        <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 2, marginBottom: 12 }}>
          สรุปรายการที่เพิ่มลูกค้าเข้า Notebook queue ในช่วงวันที่ที่เลือก (อิงวันที่เพิ่ม lead เข้า queue)
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          <SummaryCard label="ผู้ส่งออก" value={printedBy} />
          <SummaryCard label="จำนวน lead additions" value={String(leads.length)} accent={C.accent} big />
          <SummaryCard label="จำนวนการโอน" value={String(transfers.length)} accent={C.transferFg} big />
          <SummaryCard label="จำนวนครั้ง Recall" value={String(recalls.length)} accent="#b45309" big />
          <SummaryCard label="ช่วงวันที่" value={rangeShort} />
        </View>

        <LeadTable leads={leads} />
        <Footer label="Notebook Self Report · TNP" />
      </Page>

      {/* หน้า 2 — Daily Activity */}
      <Page size="A4" orientation="landscape" style={PAGE}>
        <View style={{ borderBottomWidth: 1.6, borderBottomColor: C.accent, paddingBottom: 9, marginBottom: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Daily Activity Report</Text>
          <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 2 }}>ตารางกิจกรรมประจำวันจาก activity / history รวมธุระส่วนตัวและ recall</Text>
        </View>
        <ActivityTable groups={activityGroups} />
        <TransferSection transfers={transfers} />
        <RecallSection recalls={recalls} />
        <Footer label="Notebook Self Report · TNP" />
      </Page>
    </Document>
  );
}

// ── render → Buffer (เรียกจาก route handler ให้ route ไม่ต้องมี JSX) ──────────
export function renderStandardReport(p: {
  rangeLabel: string;
  printedAt: string;
  printedBy: string;
  details: StdDetailInput[];
}): Promise<Buffer> {
  return renderToBuffer(
    <StandardReportDoc rangeLabel={p.rangeLabel} printedAt={p.printedAt} printedBy={p.printedBy} groups={buildStandardGroups(p.details)} />,
  );
}

export function renderSelfReport(p: {
  rangeLabel: string;
  rangeShort: string;
  printedAt: string;
  printedBy: string;
  leads: LeadInput[];
  recalls: RecallInput[];
  transfers: TransferInput[];
  activityItems: ActivityInput[];
}): Promise<Buffer> {
  return renderToBuffer(
    <SelfReportDoc
      rangeLabel={p.rangeLabel}
      rangeShort={p.rangeShort}
      printedAt={p.printedAt}
      printedBy={p.printedBy}
      leads={p.leads}
      transfers={p.transfers}
      recalls={p.recalls}
      activityGroups={buildActivityGroups(p.activityItems)}
    />,
  );
}
