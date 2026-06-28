import 'server-only';
import type { notebookHistories, notebooks } from '@/server/db/schema';

/**
 * พอร์ตจาก Laravel NotebookResource + NotebookHistoryResource
 * - แปลง row ของ Drizzle (camelCase) → shape API เดิม (snake_case) ให้ frontend เดิมใช้ได้ตรง ๆ
 * - สร้าง "history report snapshots" (ไล่ timeline old/new ของแต่ละ action) เหมือน buildHistoryReportSnapshots
 */

type NotebookRow = typeof notebooks.$inferSelect;
type NotebookHistoryRow = typeof notebookHistories.$inferSelect;
type Values = Record<string, unknown>;

/** ข้อมูล user ขั้นต่ำสำหรับ manage_by_user / action_by */
export type UserSummaryInput = {
  userId: number;
  username: string | null;
  userNickname: string | null;
  userFirstname: string | null;
  userLastname: string | null;
  role: string | null;
};

export type UserSummaryDTO = {
  user_id: number;
  username: string | null;
  user_nickname: string | null;
  user_firstname: string | null;
  user_lastname: string | null;
  role: string | null;
} | null;

/**
 * MariaDB เก็บ JSON เป็น longtext → mysql2 คืน string. helper นี้ parse ให้ทนทั้ง string/object/null
 * (drizzle json() ไม่ parse ให้ตอนอ่าน — ดู schema/notebooks)
 */
export function parseJson<T = Values>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '' || s === 'null') return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  }
  return null;
}

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export function toUserSummary(user: UserSummaryInput | null | undefined): UserSummaryDTO {
  if (!user) return null;
  return {
    user_id: user.userId,
    username: user.username,
    user_nickname: user.userNickname,
    user_firstname: user.userFirstname,
    user_lastname: user.userLastname,
    role: user.role,
  };
}

/** ชื่อแสดงผลของ user (ลำดับเดียวกับ Laravel: username → nickname → fullname → id) */
export function resolveUserDisplayName(user: UserSummaryInput | null | undefined): string | null {
  if (!user) return null;
  const full = `${user.userFirstname ?? ''} ${user.userLastname ?? ''}`.trim();
  return user.username ?? user.userNickname ?? (full !== '' ? full : String(user.userId));
}

// ── history report snapshots (port NotebookResource::buildHistoryReportSnapshots) ──

const CREATE_ACTIONS = new Set(['created', 'created_to_queue', 'created_to_mine']);
const isCreateAction = (a: string | null) => CREATE_ACTIONS.has(a ?? '');

function normalizeValues(v: unknown): Values | null {
  const parsed = parseJson(v);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

function resolveReportOld(current: Values | null, changedOld: Values, action: string | null): Values | null {
  if (isCreateAction(action)) return Object.keys(changedOld).length === 0 ? null : changedOld;
  if (current !== null)
    return Object.keys(changedOld).length === 0 ? current : { ...current, ...changedOld };
  return Object.keys(changedOld).length === 0 ? null : changedOld;
}

function resolveReportNew(reportOld: Values | null, changedNew: Values, action: string | null): Values | null {
  if (action === 'deleted') return null;
  if (isCreateAction(action)) return Object.keys(changedNew).length === 0 ? reportOld : changedNew;
  if (reportOld !== null)
    return Object.keys(changedNew).length === 0 ? reportOld : { ...reportOld, ...changedNew };
  return Object.keys(changedNew).length === 0 ? null : changedNew;
}

const snapshotKey = (h: Pick<NotebookHistoryRow, 'id'>, index: number) =>
  h.id != null ? `history-${h.id}` : `history-index-${index}`;

/** สร้าง map ของ report old/new ต่อ history (ไล่ timeline จากเก่า→ใหม่) */
export function buildHistoryReportSnapshots(
  histories: NotebookHistoryRow[],
): Map<string, { old: Values | null; new: Values | null }> {
  const sorted = histories
    .map((h, index) => ({ h, index }))
    .sort((a, b) => {
      const ta = a.h.createdAt ? a.h.createdAt.getTime() : 0;
      const tb = b.h.createdAt ? b.h.createdAt.getTime() : 0;
      if (ta !== tb) return ta - tb;
      const ia = a.h.id ?? 0;
      const ib = b.h.id ?? 0;
      if (ia !== ib) return ia - ib;
      return a.index - b.index;
    });

  const snapshots = new Map<string, { old: Values | null; new: Values | null }>();
  let current: Values | null = null;

  for (const { h, index } of sorted) {
    const changedOld = normalizeValues(h.oldValues) ?? {};
    const changedNew = normalizeValues(h.newValues) ?? {};
    const reportOld = resolveReportOld(current, changedOld, h.action);
    const reportNew = resolveReportNew(reportOld, changedNew, h.action);
    snapshots.set(snapshotKey(h, index), { old: reportOld, new: reportNew });
    current = reportNew;
  }

  return snapshots;
}

/** แทน id ในฟิลด์ nb_manage_by ด้วยชื่อ user (เลียน buildDisplayValues) */
function buildDisplayValues(values: Values | null, userNames: Map<number, string>): Values | null {
  if (!values) return values;
  if (!('nb_manage_by' in values)) return { ...values };
  const v = values.nb_manage_by;
  let display: unknown = v;
  if (v != null && v !== '' && typeof v !== 'object') {
    const id = Number(v);
    if (Number.isFinite(id) && id > 0) display = userNames.get(id) ?? String(v);
  }
  return { ...values, nb_manage_by: display };
}

export type HistoryInput = { history: NotebookHistoryRow; actionBy?: UserSummaryInput | null };

export function toHistoryDTO(
  input: HistoryInput,
  report: { old: Values | null; new: Values | null },
  userNames: Map<number, string>,
) {
  const { history, actionBy } = input;
  const oldValues = normalizeValues(history.oldValues);
  const newValues = normalizeValues(history.newValues);
  return {
    id: history.id,
    notebook_id: history.notebookId,
    action: history.action,
    old_values: oldValues,
    new_values: newValues,
    display_old_values: buildDisplayValues(oldValues, userNames),
    display_new_values: buildDisplayValues(newValues, userNames),
    report_old_values: report.old,
    report_new_values: report.new,
    display_report_old_values: buildDisplayValues(report.old, userNames),
    display_report_new_values: buildDisplayValues(report.new, userNames),
    action_by: toUserSummary(actionBy),
    ip_address: history.ipAddress,
    user_agent: history.userAgent,
    created_at: toIso(history.createdAt),
    updated_at: toIso(history.updatedAt),
  };
}

/** snake_case attribute map ของ notebook (เลียน Eloquent getAttributes — ไม่รวม relation) */
export function toNotebookAttributes(nb: NotebookRow) {
  return {
    id: nb.id,
    nb_date: nb.nbDate,
    nb_time: nb.nbTime,
    nb_customer_name: nb.nbCustomerName,
    nb_is_online: nb.nbIsOnline,
    nb_additional_info: nb.nbAdditionalInfo,
    nb_contact_number: nb.nbContactNumber,
    nb_email: nb.nbEmail,
    nb_contact_person: nb.nbContactPerson,
    nb_action: nb.nbAction,
    nb_status: nb.nbStatus,
    nb_remarks: nb.nbRemarks,
    nb_next_followup_date: nb.nbNextFollowupDate,
    nb_next_followup_note: nb.nbNextFollowupNote,
    nb_is_favorite: nb.nbIsFavorite,
    nb_is_fresh_queue: nb.nbIsFreshQueue,
    nb_manage_by: nb.nbManageBy,
    nb_workflow: nb.nbWorkflow,
    nb_entry_type: nb.nbEntryType,
    nb_source_type: nb.nbSourceType,
    nb_source_customer_id: nb.nbSourceCustomerId,
    nb_source_notebook_id: nb.nbSourceNotebookId,
    nb_lead_payload: parseJson(nb.nbLeadPayload),
    nb_claimed_at: toIso(nb.nbClaimedAt),
    nb_converted_at: toIso(nb.nbConvertedAt),
    nb_converted_customer_id: nb.nbConvertedCustomerId,
    created_by: nb.createdBy,
    updated_by: nb.updatedBy,
    created_at: toIso(nb.createdAt),
    updated_at: toIso(nb.updatedAt),
  };
}

/**
 * fresh_queue flag — พอร์ตจาก NotebookObserver::deriveFreshQueueFlag
 * (queue lead ที่ assign แล้ว แต่ sales ยังไม่กรอก status/followup)
 */
export function deriveFreshQueue(s: {
  nbConvertedAt: Date | null;
  nbWorkflow: string;
  nbManageBy: number | null;
  nbStatus: string | null;
  nbNextFollowupDate: string | null;
  nbNextFollowupNote: string | null;
}): boolean {
  if (s.nbConvertedAt) return false;
  if (s.nbWorkflow !== 'lead_queue') return false;
  if (!s.nbManageBy) return false;
  const hasStatus = (s.nbStatus ?? '').trim() !== '';
  const hasFollowupDate = !!s.nbNextFollowupDate;
  const hasFollowupNote = (s.nbNextFollowupNote ?? '').trim() !== '';
  return !hasStatus && !hasFollowupDate && !hasFollowupNote;
}

/**
 * diff attribute (เลียน NotebookObserver::updated → getChanges ยกเว้น updated_at)
 * คืน old/new เฉพาะคีย์ที่เปลี่ยน
 */
export function diffAttributes(before: NotebookRow, after: NotebookRow): { old: Values; new: Values } {
  const b = toNotebookAttributes(before) as Record<string, unknown>;
  const a = toNotebookAttributes(after) as Record<string, unknown>;
  const old: Values = {};
  const nw: Values = {};
  for (const k of Object.keys(a)) {
    if (k === 'updated_at') continue;
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
      old[k] = b[k];
      nw[k] = a[k];
    }
  }
  return { old, new: nw };
}

export type NotebookDTO = ReturnType<typeof toNotebookDTO>;

export function toNotebookDTO(
  nb: NotebookRow,
  opts: {
    manageBy?: UserSummaryInput | null;
    histories?: HistoryInput[];
    userNames?: Map<number, string>;
  } = {},
) {
  const base = { ...toNotebookAttributes(nb), manage_by_user: toUserSummary(opts.manageBy) };

  if (!opts.histories) return base;

  const userNames = opts.userNames ?? new Map<number, string>();
  const rows = opts.histories.map((h) => h.history);
  const snapshots = buildHistoryReportSnapshots(rows);
  const histories = opts.histories.map((h, index) => {
    const report = snapshots.get(snapshotKey(h.history, index)) ?? { old: null, new: null };
    return toHistoryDTO(h, report, userNames);
  });

  return { ...base, histories };
}
