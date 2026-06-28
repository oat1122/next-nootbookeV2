import 'server-only';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { db } from '@/server/db/client';
import {
  masterCustomers,
  masterSubRoles,
  notebookHistories,
  notebooks,
  recallActionLogs,
  userSubRoles,
  users,
} from '@/server/db/schema';
import { ForbiddenError, type SessionUser } from '@/server/auth';
import {
  canExportNotebookSelfReport,
  canViewAllNotebookScope,
  isNotebookQueueUser,
  SUB_ROLE,
} from './permissions';
import { isCreateAction, normalizeHistoryAction, resolvePeriod } from './kpi-period';
import { buildNotebookFilters, isFreshQueueSql, loadUserMap, mapNotebookRows } from './queries';
import { parseJson, type UserSummaryInput } from './mappers';
import type { AllTabStatsFilters, KpiSummaryParams, SelfReportFilters } from './validation';

const ROLE_MAP: Record<string, string> = { sales: 'sale', telesales: 'telesale', office: 'office' };
const needsRoleJoins = (s: string) => s in ROLE_MAP;
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDateTime = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** target user สำหรับ KPI (admin/manager เลือกได้ทุกคน, อื่น ๆ ล็อกตัวเอง) */
function getTargetUserId(requested: number | null | undefined, user: SessionUser): number | null {
  if (user.role === 'admin' || user.role === 'manager') return requested ?? null;
  return user.userId;
}

function canViewKpi(user: SessionUser): boolean {
  return (
    ['admin', 'manager', 'telesale', 'sale'].includes(user.role) || isNotebookQueueUser(user)
  );
}

function makeRoleAliases() {
  return {
    manageUser: alias(users, 'nb_manage_user'),
    createdUser: alias(users, 'nb_created_user'),
    createdUsr: alias(userSubRoles, 'nb_created_usr'),
    createdMsr: alias(masterSubRoles, 'nb_created_msr'),
  };
}
type RoleAliases = ReturnType<typeof makeRoleAliases>;

/** เงื่อนไขร่วมของ summary/details (port applyNotebookSourceFilter + date/user/status) */
function historyConditions(
  period: { start: string; end: string },
  sourceFilter: string,
  targetUserId: number | null,
  nbStatus: string | null,
  a: RoleAliases,
): (SQL | undefined)[] {
  const conds: (SQL | undefined)[] = [
    sql`${notebookHistories.createdAt} BETWEEN ${period.start} AND ${period.end}`,
    targetUserId ? eq(notebookHistories.actionBy, targetUserId) : undefined,
    nbStatus && nbStatus !== 'all' ? eq(notebooks.nbStatus, nbStatus) : undefined,
  ];

  if (sourceFilter === 'online') {
    conds.push(eq(notebooks.nbIsOnline, true));
  } else if (needsRoleJoins(sourceFilter)) {
    const targetRole = ROLE_MAP[sourceFilter];
    const subCode =
      targetRole === 'sale' ? SUB_ROLE.SUPPORT_SALES : targetRole === 'telesale' ? SUB_ROLE.TALESALES : null;
    const createdMatch = subCode
      ? sql`(${a.createdUser.role} = ${targetRole} OR ${a.createdMsr.msrCode} = ${subCode})`
      : sql`${a.createdUser.role} = ${targetRole}`;
    conds.push(sql`${notebooks.nbIsOnline} = 0`);
    conds.push(
      sql`((${notebooks.nbManageBy} IS NOT NULL AND ${a.manageUser.role} = ${targetRole}) OR (${notebooks.nbManageBy} IS NULL AND ${createdMatch}))`,
    );
  }
  return conds;
}

const userName = (u: UserSummaryInput | undefined, withNick: boolean, fallback: string): string => {
  if (!u) return fallback;
  const base = `${u.userFirstname ?? ''} ${u.userLastname ?? ''}`.trim();
  const nick = withNick && u.userNickname ? ` (${u.userNickname})` : '';
  const full = `${base}${nick}`.trim();
  return full !== '' ? full : fallback;
};

/** summary — นับ added/updated ต่อ user (port NotebookKpiService::getSummaryData) */
export async function getNotebookKpiSummary(params: KpiSummaryParams, user: SessionUser) {
  if (!canViewKpi(user)) throw new ForbiddenError('Unauthorized: Access denied');

  const period = resolvePeriod(params.period, params.start_date, params.end_date);
  const targetUserId = getTargetUserId(params.user_id, user);
  const sourceFilter = params.source_filter ?? 'all';
  const nbStatus = params.nb_status ?? 'all';

  const a = makeRoleAliases();
  const cols = {
    id: notebookHistories.id,
    action: notebookHistories.action,
    actionBy: notebookHistories.actionBy,
  };
  const conds = historyConditions(period, sourceFilter, targetUserId, nbStatus, a);

  const rows = needsRoleJoins(sourceFilter)
    ? await db
        .selectDistinct(cols)
        .from(notebookHistories)
        .innerJoin(notebooks, eq(notebookHistories.notebookId, notebooks.id))
        .leftJoin(a.manageUser, eq(notebooks.nbManageBy, a.manageUser.userId))
        .leftJoin(a.createdUser, eq(notebooks.createdBy, a.createdUser.userId))
        .leftJoin(a.createdUsr, eq(a.createdUser.userId, a.createdUsr.usrUserId))
        .leftJoin(a.createdMsr, eq(a.createdUsr.usrSubRoleId, a.createdMsr.msrId))
        .where(and(...conds))
    : await db
        .selectDistinct(cols)
        .from(notebookHistories)
        .innerJoin(notebooks, eq(notebookHistories.notebookId, notebooks.id))
        .where(and(...conds));

  const userMap = await loadUserMap(rows.map((r) => r.actionBy));
  const byUser = new Map<number, { added: number; updated: number }>();
  for (const r of rows) {
    if (r.actionBy == null) continue;
    const g = byUser.get(r.actionBy) ?? { added: 0, updated: 0 };
    if (isCreateAction(r.action)) g.added += 1;
    else g.updated += 1;
    byUser.set(r.actionBy, g);
  }

  const summary = [...byUser.entries()]
    .map(([userId, g]) => ({
      user_id: userId,
      user_name: userName(userMap.get(userId), true, 'ไม่ระบุ'),
      added_count: g.added,
      updated_count: g.updated,
    }))
    .sort((l, r) => r.added_count + r.updated_count - (l.added_count + l.updated_count));

  return {
    status: 'success' as const,
    data: summary,
    meta: { period: { type: period.type, start_date: period.start_date, end_date: period.end_date, label: period.label } },
  };
}

/** details — รายการ history พร้อม context notebook (port getDetailsData) */
export async function getNotebookKpiDetails(params: KpiSummaryParams, user: SessionUser) {
  if (!canViewKpi(user)) throw new ForbiddenError('Unauthorized: Access denied');

  const period = resolvePeriod(params.period, params.start_date, params.end_date);
  const targetUserId = getTargetUserId(params.user_id, user);
  const sourceFilter = params.source_filter ?? 'all';
  const nbStatus = params.nb_status ?? 'all';

  const a = makeRoleAliases();
  const cols = {
    id: notebookHistories.id,
    notebookId: notebookHistories.notebookId,
    action: notebookHistories.action,
    oldValues: notebookHistories.oldValues,
    newValues: notebookHistories.newValues,
    actionBy: notebookHistories.actionBy,
    createdAt: notebookHistories.createdAt,
    nbCustomerName: notebooks.nbCustomerName,
    nbIsOnline: notebooks.nbIsOnline,
    nbContactNumber: notebooks.nbContactNumber,
    nbStatus: notebooks.nbStatus,
    nbAdditionalInfo: notebooks.nbAdditionalInfo,
    nbRemarks: notebooks.nbRemarks,
    nbAction: notebooks.nbAction,
    nbDate: notebooks.nbDate,
    nbTime: notebooks.nbTime,
  };
  const conds = historyConditions(period, sourceFilter, targetUserId, nbStatus, a);

  const rows = needsRoleJoins(sourceFilter)
    ? await db
        .selectDistinct(cols)
        .from(notebookHistories)
        .innerJoin(notebooks, eq(notebookHistories.notebookId, notebooks.id))
        .leftJoin(a.manageUser, eq(notebooks.nbManageBy, a.manageUser.userId))
        .leftJoin(a.createdUser, eq(notebooks.createdBy, a.createdUser.userId))
        .leftJoin(a.createdUsr, eq(a.createdUser.userId, a.createdUsr.usrUserId))
        .leftJoin(a.createdMsr, eq(a.createdUsr.usrSubRoleId, a.createdMsr.msrId))
        .where(and(...conds))
        .orderBy(desc(notebookHistories.createdAt))
    : await db
        .selectDistinct(cols)
        .from(notebookHistories)
        .innerJoin(notebooks, eq(notebookHistories.notebookId, notebooks.id))
        .where(and(...conds))
        .orderBy(desc(notebookHistories.createdAt));

  const userMap = await loadUserMap(rows.map((r) => r.actionBy));
  const details = rows.map((r) => ({
    history_id: r.id,
    notebook_id: r.notebookId,
    nb_customer_name: [r.nbCustomerName, r.nbIsOnline ? '(Online)' : null].filter(Boolean).join(' '),
    nb_contact_number: r.nbContactNumber,
    nb_status: r.nbStatus,
    nb_additional_info: r.nbAdditionalInfo,
    nb_remarks: r.nbRemarks,
    nb_action: r.nbAction,
    nb_date: r.nbDate,
    nb_time: r.nbTime,
    action_type: normalizeHistoryAction(r.action),
    old_values: parseJson(r.oldValues),
    new_values: parseJson(r.newValues),
    action_by_name: userName(r.actionBy ? userMap.get(r.actionBy) : undefined, false, 'admin'),
    created_at: r.createdAt ? fmtDateTime(r.createdAt) : null,
  }));

  return {
    status: 'success' as const,
    data: details,
    meta: { period: { type: period.type, start_date: period.start_date, end_date: period.end_date, label: period.label } },
  };
}

/** all-tab-stats — สรุป total/called/pending/converted (port getAllTabStats) */
export async function getNotebookAllTabStats(filters: AllTabStatsFilters, user: SessionUser) {
  if (!canViewAllNotebookScope(user)) {
    throw new ForbiddenError('Unauthorized: คุณไม่มีสิทธิ์ดูสรุปยอด Lead ทั้งหมด');
  }
  const where = buildNotebookFilters(filters, user, 'all');
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      // derive fresh จาก state จริง (column nb_is_fresh_queue drift) — ใช้ isFreshQueueSql ตัวเดียวกับ ORDER BY
      called: sql<number>`SUM(CASE WHEN ${notebooks.nbWorkflow} = 'lead_queue' AND ${notebooks.nbManageBy} IS NOT NULL AND NOT ${isFreshQueueSql()} THEN 1 ELSE 0 END)`,
      pending: sql<number>`SUM(CASE WHEN ${isFreshQueueSql()} THEN 1 ELSE 0 END)`,
      converted: sql<number>`SUM(CASE WHEN ${notebooks.nbConvertedCustomerId} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(notebooks)
    .where(where);

  return {
    success: true as const,
    data: {
      total: Number(row?.total ?? 0),
      called: Number(row?.called ?? 0),
      pending: Number(row?.pending ?? 0),
      converted: Number(row?.converted ?? 0),
    },
  };
}

/** self-report — export ของ telesale (port NotebookController::selfReport) */
export async function getNotebookSelfReport(filters: SelfReportFilters, user: SessionUser) {
  if (!canExportNotebookSelfReport(user)) {
    throw new ForbiddenError('Unauthorized: You do not have permission to export this notebook report.');
  }

  const start = filters.start_date ?? null;
  const end = filters.end_date ?? null;

  // lead additions: lead_queue ที่ user สร้างในช่วง (created_at)
  const leadRows = await db
    .select()
    .from(notebooks)
    .where(
      and(
        eq(notebooks.nbWorkflow, 'lead_queue'),
        eq(notebooks.createdBy, user.userId),
        start && end
          ? sql`${notebooks.createdAt} BETWEEN ${`${start} 00:00:00`} AND ${`${end} 23:59:59`}`
          : undefined,
      ),
    )
    .orderBy(desc(notebooks.createdAt));

  // activity items: notebook ที่มี history โดย user ในช่วง
  const histNotebookRows = await db
    .selectDistinct({ nid: notebookHistories.notebookId })
    .from(notebookHistories)
    .where(
      and(
        eq(notebookHistories.actionBy, user.userId),
        start && end
          ? sql`${notebookHistories.createdAt} BETWEEN ${`${start} 00:00:00`} AND ${`${end} 23:59:59`}`
          : undefined,
      ),
    );
  const activityIds = histNotebookRows.map((r) => r.nid).filter((x): x is number => x != null);
  const activityRows = activityIds.length
    ? await db.select().from(notebooks).where(inArray(notebooks.id, activityIds)).orderBy(desc(notebooks.updatedAt))
    : [];

  // recall actions (default ช่วง = เดือนนี้ ถ้าไม่ระบุ)
  const month = resolvePeriod('month', null, null);
  const rStart = `${start ?? month.start_date} 00:00:00`;
  const rEnd = `${end ?? month.end_date} 23:59:59`;
  const recallRows = await db
    .select({
      id: recallActionLogs.id,
      company: masterCustomers.cusCompany,
      name: masterCustomers.cusName,
      recallNote: recallActionLogs.recallNote,
      wasOverdue: recallActionLogs.wasOverdue,
      daysOverdue: recallActionLogs.daysOverdue,
      createdAt: recallActionLogs.createdAt,
    })
    .from(recallActionLogs)
    .leftJoin(masterCustomers, eq(masterCustomers.cusId, recallActionLogs.customerId))
    .where(
      and(eq(recallActionLogs.userId, user.userId), sql`${recallActionLogs.createdAt} BETWEEN ${rStart} AND ${rEnd}`),
    )
    .orderBy(asc(recallActionLogs.createdAt));

  return {
    lead_additions: await mapNotebookRows(leadRows, true),
    activity_items: await mapNotebookRows(activityRows, true),
    recall_actions: recallRows.map((r) => ({
      id: r.id,
      customer_name: r.company || r.name || '-',
      recall_note: r.recallNote,
      was_overdue: r.wasOverdue,
      days_overdue: r.daysOverdue,
      created_at: r.createdAt ? r.createdAt.toISOString() : null,
    })),
    meta: { start_date: start, end_date: end, exported_at: new Date().toISOString() },
  };
}
