import { describe, expect, it } from 'vitest';
import type { SessionUser } from '@/server/auth';
import {
  canAssignNotebookQueue,
  canConvert,
  canCreateCustomerCare,
  canDelete,
  canEdit,
  canExportNotebookSelfReport,
  canManageAllNotebooks,
  canReserve,
  canReserveNotebookQueue,
  canView,
  canViewAllNotebookScope,
  canViewNotebookQueue,
  isNotebookQueueUser,
  type NotebookAuthFields,
  shouldCreateLeadIntoMine,
  shouldCreateLeadIntoQueue,
  SUB_ROLE,
} from './permissions';

const u = (role: SessionUser['role'], subRoleCodes: string[] = [], userId = 1): SessionUser => ({
  userId,
  userUuid: 'x',
  username: 'x',
  role,
  firstName: null,
  lastName: null,
  nickname: null,
  position: null,
  subRoleCodes,
});

const nb = (over: Partial<NotebookAuthFields> = {}): NotebookAuthFields => ({
  nbManageBy: null,
  nbWorkflow: 'standard',
  nbConvertedAt: null,
  ...over,
});

describe('role/sub-role permissions (port UserSubRoleHelper)', () => {
  it('canManageAllNotebooks: admin/manager เท่านั้น', () => {
    expect(canManageAllNotebooks(u('admin'))).toBe(true);
    expect(canManageAllNotebooks(u('manager'))).toBe(true);
    expect(canManageAllNotebooks(u('sale'))).toBe(false);
    expect(canManageAllNotebooks(u('telesale'))).toBe(false);
  });

  it('isNotebookQueueUser: SUPPORT_SALES หรือ TALESALES', () => {
    expect(isNotebookQueueUser(u('sale', [SUB_ROLE.SUPPORT_SALES]))).toBe(true);
    expect(isNotebookQueueUser(u('sale', [SUB_ROLE.TALESALES]))).toBe(true);
    expect(isNotebookQueueUser(u('sale', [SUB_ROLE.HEAD_OFFLINE]))).toBe(false);
    expect(isNotebookQueueUser(u('sale'))).toBe(false);
  });

  it('canViewAllNotebookScope: admin/manager หรือ SUPPORT_SALES/HEAD_OFFLINE', () => {
    expect(canViewAllNotebookScope(u('admin'))).toBe(true);
    expect(canViewAllNotebookScope(u('sale', [SUB_ROLE.SUPPORT_SALES]))).toBe(true);
    expect(canViewAllNotebookScope(u('sale', [SUB_ROLE.HEAD_OFFLINE]))).toBe(true);
    expect(canViewAllNotebookScope(u('sale', [SUB_ROLE.TALESALES]))).toBe(false);
    expect(canViewAllNotebookScope(u('sale'))).toBe(false);
  });

  it('canViewNotebookQueue: admin/manager, queue-view sub-roles, หรือ role=sale', () => {
    expect(canViewNotebookQueue(u('admin'))).toBe(true);
    expect(canViewNotebookQueue(u('sale'))).toBe(true);
    expect(canViewNotebookQueue(u('telesale', [SUB_ROLE.HEAD_OFFLINE]))).toBe(true);
    expect(canViewNotebookQueue(u('telesale'))).toBe(false);
  });

  it('canAssign/canReserveNotebookQueue: admin หรือ SUPPORT_SALES/HEAD_OFFLINE', () => {
    for (const fn of [canAssignNotebookQueue, canReserveNotebookQueue]) {
      expect(fn(u('admin'))).toBe(true);
      expect(fn(u('sale', [SUB_ROLE.SUPPORT_SALES]))).toBe(true);
      expect(fn(u('sale', [SUB_ROLE.HEAD_OFFLINE]))).toBe(true);
      expect(fn(u('sale', [SUB_ROLE.TALESALES]))).toBe(false);
      expect(fn(u('sale'))).toBe(false);
    }
  });

  it('canExportNotebookSelfReport: queue user หรือ role=sale (admin ไม่มี subrole → false)', () => {
    expect(canExportNotebookSelfReport(u('sale'))).toBe(true);
    expect(canExportNotebookSelfReport(u('telesale', [SUB_ROLE.TALESALES]))).toBe(true);
    expect(canExportNotebookSelfReport(u('admin'))).toBe(false);
    expect(canExportNotebookSelfReport(u('telesale', [SUB_ROLE.HEAD_OFFLINE]))).toBe(false);
  });

  it('shouldCreateLeadIntoQueue', () => {
    expect(shouldCreateLeadIntoQueue(u('sale', [SUB_ROLE.SUPPORT_SALES]), 'queue')).toBe(true);
    expect(shouldCreateLeadIntoQueue(u('sale'), 'queue')).toBe(false);
    expect(shouldCreateLeadIntoQueue(u('sale', [SUB_ROLE.SUPPORT_SALES]), 'mine')).toBe(false);
    expect(shouldCreateLeadIntoQueue(u('sale', [SUB_ROLE.TALESALES]))).toBe(true);
  });

  it('shouldCreateLeadIntoMine', () => {
    expect(shouldCreateLeadIntoMine(u('sale'), 'mine')).toBe(true);
    expect(shouldCreateLeadIntoMine(u('telesale', [SUB_ROLE.SUPPORT_SALES]), 'mine')).toBe(true);
    expect(shouldCreateLeadIntoMine(u('telesale'), 'mine')).toBe(false);
    expect(shouldCreateLeadIntoMine(u('sale'), 'queue')).toBe(false);
    // default: sale ที่ไม่ใช่ queue user → mine; sale ที่เป็น queue user → ไม่
    expect(shouldCreateLeadIntoMine(u('sale'))).toBe(true);
    expect(shouldCreateLeadIntoMine(u('sale', [SUB_ROLE.TALESALES]))).toBe(false);
  });

  it('canDelete=admin / canCreateCustomerCare=sale', () => {
    expect(canDelete(u('admin'))).toBe(true);
    expect(canDelete(u('manager'))).toBe(false);
    expect(canCreateCustomerCare(u('sale'))).toBe(true);
    expect(canCreateCustomerCare(u('admin'))).toBe(false);
  });
});

describe('record-level permissions (port NotebookService::can*)', () => {
  it('canView: admin, เจ้าของ, หรือ queue-inbox ที่ยังว่าง', () => {
    expect(canView(u('admin'), nb({ nbManageBy: 999 }))).toBe(true);
    expect(canView(u('sale', [], 42), nb({ nbManageBy: 42 }))).toBe(true);
    // sale เห็น lead_queue ที่ยังไม่มีเจ้าของได้ (queue inbox)
    expect(canView(u('sale'), nb({ nbWorkflow: 'lead_queue', nbManageBy: null }))).toBe(true);
    // standard ของคนอื่น → ไม่เห็น
    expect(canView(u('sale', [], 1), nb({ nbManageBy: 2 }))).toBe(false);
  });

  it('canEdit/canConvert: admin หรือเจ้าของเท่านั้น (queue-inbox แก้ไม่ได้)', () => {
    expect(canEdit(u('admin'), nb({ nbManageBy: 999 }))).toBe(true);
    expect(canEdit(u('sale', [], 42), nb({ nbManageBy: 42 }))).toBe(true);
    // sale เห็น queue inbox ได้ แต่แก้ไม่ได้
    expect(canEdit(u('sale'), nb({ nbWorkflow: 'lead_queue', nbManageBy: null }))).toBe(false);
    expect(canConvert(u('sale', [], 1), nb({ nbManageBy: 2 }))).toBe(false);
  });

  it('canReserve: lead_queue + ว่าง + ยังไม่ converted + (admin/assign sub-role)', () => {
    const freshQueue = nb({ nbWorkflow: 'lead_queue', nbManageBy: null });
    expect(canReserve(u('sale', [SUB_ROLE.SUPPORT_SALES]), freshQueue)).toBe(true);
    expect(canReserve(u('admin'), freshQueue)).toBe(true);
    expect(canReserve(u('sale'), freshQueue)).toBe(false);
    // converted แล้ว → ไม่ได้
    expect(
      canReserve(u('admin'), nb({ nbWorkflow: 'lead_queue', nbConvertedAt: new Date() })),
    ).toBe(false);
    // standard → ไม่ได้
    expect(canReserve(u('admin'), nb({ nbWorkflow: 'standard' }))).toBe(false);
  });
});
