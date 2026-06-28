import 'server-only';
import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { notebookHistories, notebooks, users } from '@/server/db/schema';
import { ForbiddenError, type SessionUser } from '@/server/auth';
import {
  canView,
  canViewAllNotebookScope,
  canViewNotebookQueue,
  type NotebookAuthFields,
} from './permissions';
import {
  parseJson,
  resolveUserDisplayName,
  toNotebookDTO,
  type HistoryInput,
  type NotebookDTO,
  type UserSummaryInput,
} from './mappers';
import type { IndexFilters } from './validation';

/**
 * Read layer พอร์ตจาก NotebookRepository::buildIndexQuery + scopeVisibleTo + Resource includes
 * เรียกตรงใน Server Component (ตามคอนเวนชัน CLAUDE.md — reads ไม่ใช่ server action)
 */

const userSummaryCols = {
  userId: users.userId,
  username: users.username,
  userNickname: users.userNickname,
  userFirstname: users.userFirstname,
  userLastname: users.userLastname,
  role: users.role,
} as const;

/** โหลด user summary เป็น Map ตาม id (กัน N+1) */
async function loadUserMap(ids: Array<number | null | undefined>): Promise<Map<number, UserSummaryInput>> {
  const uniq = [...new Set(ids.filter((x): x is number => typeof x === 'number' && x > 0))];
  if (uniq.length === 0) return new Map();
  const rows = await db.select(userSummaryCols).from(users).where(inArray(users.userId, uniq));
  return new Map(rows.map((r) => [r.userId, r]));
}

const displayNameMap = (userMap: Map<number, UserSummaryInput>): Map<number, string> =>
  new Map([...userMap].map(([id, u]) => [id, resolveUserDisplayName(u) ?? String(id)]));

/** เก็บ user id ที่โผล่ในฟิลด์ nb_manage_by ภายใน history values (ไว้ resolve ชื่อตอนแสดงผล) */
function collectManageByIdsFromHistories(rows: (typeof notebookHistories.$inferSelect)[]): number[] {
  const ids: number[] = [];
  for (const r of rows) {
    for (const v of [parseJson(r.oldValues), parseJson(r.newValues)]) {
      const raw = v && typeof v === 'object' ? (v as Record<string, unknown>).nb_manage_by : undefined;
      const id = Number(raw);
      if (Number.isFinite(id) && id > 0) ids.push(id);
    }
  }
  return ids;
}

/** โหลด histories ของหลาย notebook ในครั้งเดียว → Map<notebookId, HistoryInput[]> (เรียง desc created_at) */
async function loadHistoriesMap(notebookIds: number[]): Promise<{
  map: Map<number, HistoryInput[]>;
  historyRows: (typeof notebookHistories.$inferSelect)[];
  actionByIds: number[];
}> {
  if (notebookIds.length === 0) return { map: new Map(), historyRows: [], actionByIds: [] };
  const rows = await db
    .select()
    .from(notebookHistories)
    .where(inArray(notebookHistories.notebookId, notebookIds))
    .orderBy(desc(notebookHistories.createdAt));

  const actionByIds = rows.map((r) => r.actionBy).filter((x): x is number => x != null);
  const userMap = await loadUserMap([...actionByIds, ...collectManageByIdsFromHistories(rows)]);

  const map = new Map<number, HistoryInput[]>();
  for (const history of rows) {
    const list = map.get(history.notebookId) ?? [];
    list.push({ history, actionBy: history.actionBy ? (userMap.get(history.actionBy) ?? null) : null });
    map.set(history.notebookId, list);
  }
  return { map, historyRows: rows, actionByIds };
}

// ── visibleTo + filters (port scopeVisibleTo + buildIndexQuery) ──────────────

function visibleToCondition(user: SessionUser, scope?: string | null): SQL | undefined {
  const resolved = scope ?? (canViewAllNotebookScope(user) ? 'all' : 'mine');

  if (resolved === 'queue') {
    if (!canViewNotebookQueue(user)) return sql`1 = 0`;
    return and(
      eq(notebooks.nbWorkflow, 'lead_queue'),
      isNull(notebooks.nbManageBy),
      isNull(notebooks.nbConvertedAt),
    );
  }
  if (canViewAllNotebookScope(user) && resolved === 'all') return undefined;
  return eq(notebooks.nbManageBy, user.userId);
}

function searchCondition(search?: string | null): SQL | undefined {
  if (!search) return undefined;
  const term = `%${search}%`;
  return sql`(${notebooks.nbCustomerName} LIKE ${term} OR ${notebooks.nbContactNumber} LIKE ${term} OR ${notebooks.nbContactPerson} LIKE ${term})`;
}

function dateRangeCondition(
  start?: string | null,
  end?: string | null,
  by?: string | null,
): SQL | undefined {
  if (!start || !end) return undefined;
  const column = ['nb_date', 'created_at', 'updated_at', 'all'].includes(by ?? '') ? by : 'nb_date';
  const lo = `${start} 00:00:00`;
  const hi = `${end} 23:59:59`;
  if (column === 'all') {
    return sql`(${notebooks.createdAt} BETWEEN ${lo} AND ${hi} OR ${notebooks.updatedAt} BETWEEN ${lo} AND ${hi})`;
  }
  if (column === 'nb_date') {
    return sql`${notebooks.nbDate} BETWEEN ${start} AND ${end}`;
  }
  const col = column === 'created_at' ? notebooks.createdAt : notebooks.updatedAt;
  return sql`${col} BETWEEN ${lo} AND ${hi}`;
}

/**
 * เงื่อนไข SQL ของแต่ละ "เมตริก" (= การ์ดสรุป) — สร้างใหม่ทุกครั้ง (เลี่ยง reuse instance)
 * ใช้ร่วมทั้ง getNotebookStats (SUM CASE) และตัวกรองรายการ (metricCondition) เพื่อรับประกัน
 * ว่าตัวเลขบนการ์ด = จำนวนแถวตอนกดการ์ดเป๊ะ
 */
function metricSqls(today: string) {
  const notClosed = sql`(${notebooks.nbStatus} IS NULL OR ${notebooks.nbStatus} NOT IN ('ได้งาน', 'หลุด', 'ไม่ได้งาน'))`;
  return {
    today: sql`(${notClosed} AND ${notebooks.nbNextFollowupDate} = ${today})`,
    overdue: sql`(${notClosed} AND ${notebooks.nbNextFollowupDate} IS NOT NULL AND ${notebooks.nbNextFollowupDate} < ${today})`,
    won: sql`(${notebooks.nbStatus} = 'ได้งาน')`,
    converted: sql`(${notebooks.nbConvertedAt} IS NOT NULL)`,
  };
}

function metricCondition(metric?: string | null): SQL | undefined {
  if (!metric) return undefined;
  const sqls = metricSqls(bangkokToday());
  return metric in sqls ? sqls[metric as keyof typeof sqls] : undefined;
}

/** ฟิลด์ filter ที่ buildNotebookFilters อ่าน (รองรับทั้ง index และ all-tab-stats) */
export type NotebookFilterInput = {
  scope?: string | null;
  search?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  date_filter_by?: string | null;
  status?: string | null;
  action?: string | null;
  entry_type?: string | null;
  workflow?: string | null;
  manage_by?: number | null;
  metric?: string | null;
};

/** เงื่อนไข where รวมของ index (ใช้ทั้ง list และ all-tab-stats) */
export function buildNotebookFilters(
  filters: NotebookFilterInput,
  user: SessionUser,
  forcedScope?: string | null,
): SQL | undefined {
  const conds: Array<SQL | undefined> = [
    visibleToCondition(user, forcedScope ?? filters.scope),
    searchCondition(filters.search),
    dateRangeCondition(filters.start_date, filters.end_date, filters.date_filter_by),
    filters.status ? eq(notebooks.nbStatus, filters.status) : undefined,
    filters.action ? eq(notebooks.nbAction, filters.action) : undefined,
    filters.entry_type && filters.entry_type !== 'all'
      ? eq(notebooks.nbEntryType, filters.entry_type)
      : undefined,
    filters.workflow ? eq(notebooks.nbWorkflow, filters.workflow) : undefined,
    filters.manage_by != null ? eq(notebooks.nbManageBy, filters.manage_by) : undefined,
    metricCondition(filters.metric),
  ];
  return and(...conds);
}

/**
 * SQL นิยาม "fresh queue" — ตรง logic กับ deriveFreshQueue() ใน mappers เป๊ะ
 * ใช้แทนการอ่าน column nb_is_fresh_queue (denormalize, หลายระบบเขียน → drift; พบ row ที่ flag
 * ไม่ตรง state จริง) ทั้งใน ORDER BY และ KPI. เป็น function คืน SQL ใหม่ทุกครั้ง เลี่ยง reuse instance
 */
export function isFreshQueueSql(): SQL {
  return sql`(${notebooks.nbWorkflow} = 'lead_queue'
    AND ${notebooks.nbManageBy} IS NOT NULL
    AND ${notebooks.nbConvertedAt} IS NULL
    AND (${notebooks.nbStatus} IS NULL OR TRIM(${notebooks.nbStatus}) = '')
    AND ${notebooks.nbNextFollowupDate} IS NULL
    AND (${notebooks.nbNextFollowupNote} IS NULL OR TRIM(${notebooks.nbNextFollowupNote}) = ''))`;
}

export type NotebookListResult =
  | { paginated: true; data: NotebookDTO[]; total: number; perPage: number; page: number; lastPage: number }
  | { paginated: false; data: NotebookDTO[] };

/** index — list notebooks ตาม filter/scope/pagination */
export async function listNotebooks(
  filters: IndexFilters,
  user: SessionUser,
  page = 1,
): Promise<NotebookListResult> {
  const where = buildNotebookFilters(filters, user);
  const order = [
    desc(notebooks.nbIsFavorite),
    desc(isFreshQueueSql()),
    desc(notebooks.createdAt),
  ];
  const wantHistories = (filters.include ?? '').includes('histories');
  const paginate = filters.paginate ?? true;

  let rows: (typeof notebooks.$inferSelect)[];
  let total = 0;
  let perPage = filters.per_page ?? 15;

  if (paginate) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notebooks)
      .where(where);
    total = Number(countRow?.count ?? 0);
    rows = await db
      .select()
      .from(notebooks)
      .where(where)
      .orderBy(...order)
      .limit(perPage)
      .offset((page - 1) * perPage);
  } else {
    rows = await db
      .select()
      .from(notebooks)
      .where(where)
      .orderBy(...order);
    perPage = rows.length;
  }

  const data = await mapNotebookRows(rows, wantHistories);

  if (paginate) {
    return {
      paginated: true,
      data,
      total,
      perPage,
      page,
      lastPage: perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1,
    };
  }
  return { paginated: false, data };
}

/** map rows → DTO พร้อม manage_by_user (+ histories ถ้าต้องการ) แบบ batch */
export async function mapNotebookRows(
  rows: (typeof notebooks.$inferSelect)[],
  withHistories: boolean,
): Promise<NotebookDTO[]> {
  if (rows.length === 0) return [];
  const manageByMap = await loadUserMap(rows.map((r) => r.nbManageBy));

  if (!withHistories) {
    return rows.map((nb) =>
      toNotebookDTO(nb, { manageBy: nb.nbManageBy ? (manageByMap.get(nb.nbManageBy) ?? null) : null }),
    );
  }

  const { map, historyRows, actionByIds } = await loadHistoriesMap(rows.map((r) => r.id));
  const namesMap = await loadUserMap([
    ...rows.map((r) => r.nbManageBy),
    ...actionByIds,
    ...collectManageByIdsFromHistories(historyRows),
  ]);
  const userNames = displayNameMap(namesMap);

  return rows.map((nb) =>
    toNotebookDTO(nb, {
      manageBy: nb.nbManageBy ? (manageByMap.get(nb.nbManageBy) ?? null) : null,
      histories: map.get(nb.id) ?? [],
      userNames,
    }),
  );
}

/** ประกอบ DTO เดี่ยวพร้อม manageBy + histories (ไม่เช็คสิทธิ์ — ผู้เรียกจัดการเอง) */
async function assembleNotebookDTO(nb: typeof notebooks.$inferSelect): Promise<NotebookDTO> {
  const { map, historyRows, actionByIds } = await loadHistoriesMap([nb.id]);
  const userMap = await loadUserMap([
    nb.nbManageBy,
    ...actionByIds,
    ...collectManageByIdsFromHistories(historyRows),
  ]);
  const userNames = displayNameMap(userMap);

  return toNotebookDTO(nb, {
    manageBy: nb.nbManageBy ? (userMap.get(nb.nbManageBy) ?? null) : null,
    histories: map.get(nb.id) ?? [],
    userNames,
  });
}

/** show — notebook เดี่ยวพร้อม histories (เช็ก canView) คืน null ถ้าไม่พบ */
export async function getNotebook(id: number, user: SessionUser): Promise<NotebookDTO | null> {
  const nb = await findNotebookRow(id);
  if (!nb) return null;

  const authFields: NotebookAuthFields = {
    nbManageBy: nb.nbManageBy,
    nbWorkflow: nb.nbWorkflow,
    nbConvertedAt: nb.nbConvertedAt,
  };
  if (!canView(user, authFields)) {
    throw new ForbiddenError('Unauthorized: You do not have permission to view this notebook.');
  }
  return assembleNotebookDTO(nb);
}

/** ประกอบ DTO ผลลัพธ์หลัง mutation (เลียน findWithRelationsOrFail — ไม่เช็คสิทธิ์ซ้ำ) */
export async function buildNotebookDTO(id: number): Promise<NotebookDTO | null> {
  const nb = await findNotebookRow(id);
  return nb ? assembleNotebookDTO(nb) : null;
}

/** โหลด notebook row ดิบ + auth fields (ใช้ใน actions เพื่อเช็คสิทธิ์/อ่านค่าเดิม) */
export async function findNotebookRow(id: number) {
  const [nb] = await db.select().from(notebooks).where(eq(notebooks.id, id)).limit(1);
  return nb ?? null;
}

// ── stat cards (สรุปต่อ scope/entry_type สำหรับหน้า list) ─────────────────────

/** วันนี้โซน Asia/Bangkok เป็น 'YYYY-MM-DD' (en-CA = รูปแบบ ISO) — ใช้เทียบ nb_next_followup_date */
function bangkokToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export type NotebookStats = {
  total: number;
  dueToday: number;
  overdue: number;
  won: number;
  converted: number;
};

/**
 * สรุปตัวเลข stat cards — อิงแค่ scope + entry_type (ไม่อิง status/search/date chip)
 * ให้ตัวเลขภาพรวมของแท็บคงที่ ไม่แกว่งตามตัวกรองรายการ (เลียนดีไซน์ที่นับจาก scope ล้วน)
 */
export async function getNotebookStats(
  filters: { scope?: string | null; entry_type?: string | null; manage_by?: number | null },
  user: SessionUser,
): Promise<NotebookStats> {
  const where = buildNotebookFilters(
    { scope: filters.scope, entry_type: filters.entry_type, manage_by: filters.manage_by },
    user,
  );
  // ใช้เงื่อนไขชุดเดียวกับ metricCondition → ตัวเลขการ์ดตรงกับจำนวนแถวตอนกดการ์ด
  const m = metricSqls(bangkokToday());
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      dueToday: sql<number>`SUM(CASE WHEN ${m.today} THEN 1 ELSE 0 END)`,
      overdue: sql<number>`SUM(CASE WHEN ${m.overdue} THEN 1 ELSE 0 END)`,
      won: sql<number>`SUM(CASE WHEN ${m.won} THEN 1 ELSE 0 END)`,
      converted: sql<number>`SUM(CASE WHEN ${m.converted} THEN 1 ELSE 0 END)`,
    })
    .from(notebooks)
    .where(where);

  return {
    total: Number(row?.total ?? 0),
    dueToday: Number(row?.dueToday ?? 0),
    overdue: Number(row?.overdue ?? 0),
    won: Number(row?.won ?? 0),
    converted: Number(row?.converted ?? 0),
  };
}

/** รายชื่อเจ้าของโน้ต (distinct nb_manage_by) ในขอบเขต all — ป้อนตัวกรอง "ผู้ดูแล" บนแท็บทั้งหมด */
export async function listNotebookOwners(
  user: SessionUser,
): Promise<{ value: number; label: string }[]> {
  const rows = await db
    .selectDistinct({ id: notebooks.nbManageBy })
    .from(notebooks)
    .where(and(visibleToCondition(user, 'all'), sql`${notebooks.nbManageBy} IS NOT NULL`));
  const ids = rows.map((r) => r.id).filter((x): x is number => x != null);
  if (ids.length === 0) return [];
  const names = displayNameMap(await loadUserMap(ids));
  return ids
    .map((id) => ({ value: id, label: names.get(id) ?? String(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'th'));
}

export { loadUserMap, loadHistoriesMap, displayNameMap };
