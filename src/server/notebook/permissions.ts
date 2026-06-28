import 'server-only';
import type { SessionUser } from '@/server/auth';
import { NB_WORKFLOW } from '@/server/db/schema';

/**
 * พอร์ตจาก Laravel `App\Helpers\UserSubRoleHelper` + permission ระดับ record ใน
 * `App\Services\Notebook\NotebookService` แบบ 1:1 — เก็บ logic/ชื่อให้ตรงเพื่อเทียบกันได้
 *
 * อ่านสิทธิ์จาก `user.role` (enum users.role) + `user.subRoleCodes` (msr_code ที่ active)
 * ซึ่ง loadSessionUser() เติมให้แล้ว (ดู @/server/auth/verify-token)
 */

/** รหัส sub-role (ตรงกับ master_sub_roles.msr_code) */
export const SUB_ROLE = {
  HEAD_OFFLINE: 'HEAD_OFFLINE',
  SUPPORT_SALES: 'SUPPORT_SALES',
  SALES_OFFLINE: 'SALES_OFFLINE',
  TALESALES: 'TALESALES',
} as const;

const notebookQueueCodes = [SUB_ROLE.SUPPORT_SALES, SUB_ROLE.TALESALES];
const notebookQueueViewCodes = [SUB_ROLE.SUPPORT_SALES, SUB_ROLE.TALESALES, SUB_ROLE.HEAD_OFFLINE];
const notebookQueueAssignCodes = [SUB_ROLE.SUPPORT_SALES, SUB_ROLE.HEAD_OFFLINE];
const notebookAllScopeCodes = [SUB_ROLE.SUPPORT_SALES, SUB_ROLE.HEAD_OFFLINE];

export function hasAnySubRole(user: SessionUser, codes: readonly string[]): boolean {
  return user.subRoleCodes.some((code) => codes.includes(code));
}

// ── สิทธิ์ระดับ role/sub-role (เลียน UserSubRoleHelper) ──────────────────────────

export function canManageAllNotebooks(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'manager';
}

export function isNotebookQueueUser(user: SessionUser): boolean {
  return hasAnySubRole(user, notebookQueueCodes);
}

export function isSupportSales(user: SessionUser): boolean {
  return hasAnySubRole(user, [SUB_ROLE.SUPPORT_SALES]);
}

export function canViewNotebookQueue(user: SessionUser): boolean {
  return (
    canManageAllNotebooks(user) ||
    hasAnySubRole(user, notebookQueueViewCodes) ||
    user.role === 'sale'
  );
}

export function canViewAllNotebookScope(user: SessionUser): boolean {
  return canManageAllNotebooks(user) || hasAnySubRole(user, notebookAllScopeCodes);
}

export function shouldCreateLeadIntoQueue(user: SessionUser, targetScope?: string | null): boolean {
  if (targetScope === 'queue') return isNotebookQueueUser(user);
  if (targetScope === 'mine') return false;
  return isNotebookQueueUser(user);
}

export function shouldCreateLeadIntoMine(user: SessionUser, targetScope?: string | null): boolean {
  if (targetScope === 'mine') return user.role === 'sale' || isSupportSales(user);
  if (targetScope === 'queue') return false;
  return !isNotebookQueueUser(user) && user.role === 'sale';
}

export function canReserveNotebookQueue(user: SessionUser): boolean {
  if (user.role === 'admin') return true;
  return hasAnySubRole(user, notebookQueueAssignCodes);
}

export function canAssignNotebookQueue(user: SessionUser): boolean {
  if (user.role === 'admin') return true;
  return hasAnySubRole(user, notebookQueueAssignCodes);
}

export function canExportNotebookSelfReport(user: SessionUser): boolean {
  return isNotebookQueueUser(user) || user.role === 'sale';
}

export function canDelete(user: SessionUser): boolean {
  return user.role === 'admin';
}

export function canCreateCustomerCare(user: SessionUser): boolean {
  return user.role === 'sale';
}

// ── สิทธิ์ระดับ record (เลียน NotebookService::can*) ────────────────────────────

/** ฟิลด์ขั้นต่ำของ notebook ที่ใช้ตัดสินสิทธิ์ */
export type NotebookAuthFields = {
  nbManageBy: number | null;
  nbWorkflow: string;
  nbConvertedAt: Date | null;
};

export function isLeadQueue(nb: Pick<NotebookAuthFields, 'nbWorkflow'>): boolean {
  return nb.nbWorkflow === NB_WORKFLOW.LEAD_QUEUE;
}

function isQueueInboxVisibleToUser(user: SessionUser, nb: NotebookAuthFields): boolean {
  return isLeadQueue(nb) && !nb.nbManageBy && !nb.nbConvertedAt && canViewNotebookQueue(user);
}

export function canView(user: SessionUser, nb: NotebookAuthFields): boolean {
  if (canManageAllNotebooks(user)) return true;
  if (isQueueInboxVisibleToUser(user, nb)) return true;
  return nb.nbManageBy === user.userId;
}

export function canEdit(user: SessionUser, nb: NotebookAuthFields): boolean {
  if (canManageAllNotebooks(user)) return true;
  return nb.nbManageBy === user.userId;
}

export function canConvert(user: SessionUser, nb: NotebookAuthFields): boolean {
  return canEdit(user, nb);
}

export function canReserve(user: SessionUser, nb: NotebookAuthFields): boolean {
  if (!isLeadQueue(nb) || nb.nbConvertedAt) return false;
  if (canManageAllNotebooks(user)) return true;
  return canReserveNotebookQueue(user);
}
