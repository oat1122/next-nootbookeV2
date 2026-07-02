'use server';
import 'server-only';
import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import {
  masterBusinessTypes,
  masterCustomers,
  masterSubRoles,
  notebooks,
  userSubRoles,
  users,
} from '@/server/db/schema';
import { authedAction, ForbiddenError, type SessionUser } from '@/server/auth';
import { buildNotebookDTO, findNotebookRow, loadUserMap } from './queries';
import { recordHistory } from './history';
import {
  canAssignNotebookQueue,
  canConvert,
  canCreateCustomerCare,
  canDelete,
  canEdit,
  canManageAllNotebooks,
  canReserve,
  isLeadQueue,
  shouldCreateLeadIntoMine,
  shouldCreateLeadIntoQueue,
  SUB_ROLE,
  type NotebookAuthFields,
} from './permissions';
import {
  deriveFreshQueue,
  diffAttributes,
  parseJson,
  resolveUserDisplayName,
  toNotebookAttributes,
} from './mappers';
import { createCustomerFromLead } from './customer-create';
import {
  assignSchema,
  bulkAssignSchema,
  checkDuplicateSchema,
  convertSchema,
  createCustomerCareSchema,
  createLeadSchema,
  createNotebookSchema,
  createPersonalActivitySchema,
  customerCareSourceSchema,
  updateNotebookSchema,
  type BulkAssignInput,
  type CheckDuplicateInput,
  type ConvertInput,
  type CreateCustomerCareInput,
  type CreateLeadInput,
  type CreatePersonalActivityInput,
  type CustomerCareSourceFilters,
  type UpdateNotebookInput,
  type CreateNotebookInput,
} from './validation';

// ponytail: ยังไม่มี route UI ของ notebook — revalidate path กลางไว้ก่อน ค่อยผูกของจริงตอนทำหน้า
const NOTEBOOK_PATH = '/notebook';
type NotebookRow = typeof notebooks.$inferSelect;

// ── shared internals (ห้าม export non-async จากไฟล์ 'use server') ────────────

/** owner ของ lead ตอนสร้าง (port NotebookService::resolveLeadOwnerId) */
function resolveLeadOwnerId(user: SessionUser, targetScope?: string | null): number | null {
  if (shouldCreateLeadIntoQueue(user, targetScope)) return null;
  if (shouldCreateLeadIntoMine(user, targetScope)) return user.userId;
  return canManageAllNotebooks(user) ? user.userId : null;
}

const authFieldsOf = (nb: NotebookRow): NotebookAuthFields => ({
  nbManageBy: nb.nbManageBy,
  nbWorkflow: nb.nbWorkflow,
  nbConvertedAt: nb.nbConvertedAt,
});

/**
 * update notebook + บันทึก history (เลียน NotebookObserver::updating/updated)
 * - recompute nb_is_fresh_queue จาก state ที่ merge แล้ว
 * - diff getChanges (ยกเว้น updated_at) → ถ้ามีเปลี่ยน บันทึก history (action = override ?? 'updated')
 */
async function applyNotebookUpdate(
  before: NotebookRow,
  set: Partial<typeof notebooks.$inferInsert>,
  opts: { action?: string; user: SessionUser },
): Promise<void> {
  const merged = { ...before, ...set } as NotebookRow;
  const freshSet = {
    ...set,
    nbIsFreshQueue: deriveFreshQueue({
      nbConvertedAt: merged.nbConvertedAt ?? null,
      nbWorkflow: merged.nbWorkflow,
      nbManageBy: merged.nbManageBy ?? null,
      nbStatus: merged.nbStatus ?? null,
      nbNextFollowupDate: merged.nbNextFollowupDate ?? null,
      nbNextFollowupNote: merged.nbNextFollowupNote ?? null,
    }),
    updatedAt: new Date(),
  };

  await db.update(notebooks).set(freshSet).where(eq(notebooks.id, before.id));

  const after = await findNotebookRow(before.id);
  if (!after) return;
  const { old, new: nw } = diffAttributes(before, after);
  if (Object.keys(nw).length > 0) {
    await recordHistory(
      { notebookId: before.id, action: opts.action ?? 'updated', oldValues: old, newValues: nw },
      opts.user,
    );
  }
}

// ── Phase 1: CRUD ────────────────────────────────────────────────────────────

/** store — สร้าง notebook มาตรฐาน (รองรับ nb_workflow=lead_queue ตาม preparePayload เดิม) */
export const createNotebook = authedAction(async (user: SessionUser, rawInput: CreateNotebookInput) => {
  const input = createNotebookSchema.parse(rawInput);

  const workflow = input.nb_workflow === 'lead_queue' ? 'lead_queue' : 'standard';
  let manageBy: number | null;
  let claimedAt: Date | null = null;

  if (workflow === 'lead_queue') {
    manageBy = resolveLeadOwnerId(user, null);
    claimedAt = manageBy ? new Date() : null;
  } else if (!canManageAllNotebooks(user)) {
    manageBy = user.userId;
  } else {
    manageBy = input.nb_manage_by ?? null;
  }

  const now = new Date();
  const insertValues = {
    nbCustomerName: input.nb_customer_name,
    nbDate: input.nb_date ?? null,
    nbTime: input.nb_time ?? null,
    nbIsOnline: input.nb_is_online ?? false,
    nbAdditionalInfo: input.nb_additional_info ?? null,
    nbContactNumber: input.nb_contact_number ?? null,
    nbEmail: input.nb_email ?? null,
    nbContactPerson: input.nb_contact_person ?? null,
    nbAction: input.nb_action ?? null,
    nbStatus: input.nb_status ?? null,
    nbRemarks: input.nb_remarks ?? null,
    nbNextFollowupDate: input.nb_next_followup_date ?? null,
    nbNextFollowupNote: input.nb_next_followup_note ?? null,
    nbWorkflow: workflow,
    nbEntryType: 'standard',
    nbManageBy: manageBy,
    nbClaimedAt: claimedAt,
    nbIsFreshQueue: deriveFreshQueue({
      nbConvertedAt: null,
      nbWorkflow: workflow,
      nbManageBy: manageBy,
      nbStatus: input.nb_status ?? null,
      nbNextFollowupDate: input.nb_next_followup_date ?? null,
      nbNextFollowupNote: input.nb_next_followup_note ?? null,
    }),
    createdBy: user.userId,
    updatedBy: user.userId,
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await db.insert(notebooks).values(insertValues);
  const id = Number(inserted[0].insertId);

  // history (เลียน observer created): action ตาม workflow, new_values = attributes ทั้งหมด
  const createAction =
    workflow === 'lead_queue' ? (manageBy ? 'created_to_mine' : 'created_to_queue') : 'created';
  const row = await findNotebookRow(id);
  await recordHistory(
    { notebookId: id, action: createAction, oldValues: null, newValues: row ? toNotebookAttributes(row) : null },
    user,
  );

  revalidatePath(NOTEBOOK_PATH);
  return buildNotebookDTO(id);
});

/** update — แก้ไข notebook (canEdit) รองรับ _history_action='customer_info_updated' */
export const updateNotebook = authedAction(
  async (user: SessionUser, id: number, rawInput: UpdateNotebookInput) => {
    const before = await findNotebookRow(id);
    if (!before) throw new Error('Notebook not found.');
    if (!canEdit(user, authFieldsOf(before))) {
      throw new ForbiddenError('Unauthorized: You do not have permission to edit this notebook.');
    }

    const input = updateNotebookSchema.parse(rawInput);
    const present = (key: string) => key in (rawInput as object);
    const set: Partial<typeof notebooks.$inferInsert> = { updatedBy: user.userId };

    if (present('nb_customer_name')) set.nbCustomerName = input.nb_customer_name;
    if (present('nb_date')) set.nbDate = input.nb_date ?? null;
    if (present('nb_time')) set.nbTime = input.nb_time ?? null;
    if (present('nb_is_online')) set.nbIsOnline = input.nb_is_online;
    if (present('nb_additional_info')) set.nbAdditionalInfo = input.nb_additional_info ?? null;
    if (present('nb_contact_number')) set.nbContactNumber = input.nb_contact_number ?? null;
    if (present('nb_email')) set.nbEmail = input.nb_email ?? null;
    if (present('nb_contact_person')) set.nbContactPerson = input.nb_contact_person ?? null;
    if (present('nb_action')) set.nbAction = input.nb_action ?? null;
    if (present('nb_status')) set.nbStatus = input.nb_status ?? null;
    if (present('nb_remarks')) set.nbRemarks = input.nb_remarks ?? null;
    if (present('nb_next_followup_date')) set.nbNextFollowupDate = input.nb_next_followup_date ?? null;
    if (present('nb_next_followup_note')) set.nbNextFollowupNote = input.nb_next_followup_note ?? null;
    if (present('nb_is_favorite')) set.nbIsFavorite = input.nb_is_favorite;
    // หมวดหมู่ธุรกิจ — merge ลง nb_lead_payload (เก็บที่เดียวกับตอนสร้างลีด) → ไหลต่อไป customer ตอน convert
    if (present('cus_bt_id')) {
      const payload = (parseJson(before.nbLeadPayload) as Record<string, unknown> | null) ?? {};
      set.nbLeadPayload = { ...payload, cus_bt_id: input.cus_bt_id ?? null };
    }
    // nb_manage_by เปลี่ยนได้เฉพาะ canManageAll (เลียน preparePayload)
    if (canManageAllNotebooks(user) && present('nb_manage_by')) set.nbManageBy = input.nb_manage_by ?? null;

    await applyNotebookUpdate(before, set, { action: input._history_action, user });

    revalidatePath(NOTEBOOK_PATH);
    return buildNotebookDTO(id);
  },
);

/** destroy — ลบ notebook (admin เท่านั้น; ตารางไม่มี soft delete → hard delete) */
export const deleteNotebook = authedAction(async (user: SessionUser, id: number) => {
  if (!canDelete(user)) {
    throw new ForbiddenError('Unauthorized: Only Admin can delete notebooks.');
  }
  const before = await findNotebookRow(id);
  if (!before) throw new Error('Notebook not found.');

  await db.delete(notebooks).where(eq(notebooks.id, id));
  // history (เลียน observer deleted): old = attributes, new = null
  await recordHistory(
    { notebookId: id, action: 'deleted', oldValues: toNotebookAttributes(before), newValues: null },
    user,
  );

  revalidatePath(NOTEBOOK_PATH);
  return { success: true };
});

// ── Phase 2: lead queue workflow ─────────────────────────────────────────────

/** ชื่อแสดงผลของ lead (port resolveLeadDisplayName) */
function resolveLeadDisplayName(input: CreateLeadInput): string {
  const company = (input.cus_company ?? '').trim();
  if (company) return company;
  const full = `${input.cus_firstname ?? ''} ${input.cus_lastname ?? ''}`.trim();
  if (full) return full;
  return (input.cus_name ?? '').trim();
}

/** leads — สร้าง lead_queue/standard lead (port NotebookService::createLead) */
export const createLeadNotebook = authedAction(async (user: SessionUser, rawInput: CreateLeadInput) => {
  const input = createLeadSchema.parse(rawInput);
  const targetScope = input.target_scope ?? null;

  if (!shouldCreateLeadIntoQueue(user, targetScope) && !shouldCreateLeadIntoMine(user, targetScope)) {
    throw new ForbiddenError('Unauthorized: You do not have permission to create notebook leads.');
  }

  const ownerId = resolveLeadOwnerId(user, targetScope);
  const workflow = shouldCreateLeadIntoMine(user, targetScope) ? 'standard' : 'lead_queue';
  const contactPerson = `${input.cus_firstname ?? ''} ${input.cus_lastname ?? ''}`.trim();
  const { target_scope: _drop, ...leadPayload } = input;
  void _drop;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const insertValues = {
    nbDate: todayStr,
    nbTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    nbCustomerName: resolveLeadDisplayName(input),
    nbIsOnline: input.cus_channel === 2,
    nbAdditionalInfo: input.cd_note ?? null,
    nbContactNumber: input.cus_tel_1 ?? null,
    nbEmail: input.cus_email ?? null,
    nbContactPerson: contactPerson !== '' ? contactPerson : (input.cus_name ?? null),
    nbStatus: null,
    nbAction: null,
    nbRemarks: input.cd_remark ?? null,
    nbManageBy: ownerId,
    nbWorkflow: workflow,
    nbEntryType: 'standard',
    nbLeadPayload: leadPayload,
    nbClaimedAt: ownerId ? now : null,
    nbIsFreshQueue: deriveFreshQueue({
      nbConvertedAt: null,
      nbWorkflow: workflow,
      nbManageBy: ownerId,
      nbStatus: null,
      nbNextFollowupDate: null,
      nbNextFollowupNote: null,
    }),
    createdBy: user.userId,
    updatedBy: user.userId,
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await db.insert(notebooks).values(insertValues);
  const id = Number(inserted[0].insertId);
  const createAction =
    workflow === 'lead_queue' ? (ownerId ? 'created_to_mine' : 'created_to_queue') : 'created';
  const row = await findNotebookRow(id);
  await recordHistory(
    { notebookId: id, action: createAction, oldValues: null, newValues: row ? toNotebookAttributes(row) : null },
    user,
  );

  revalidatePath(NOTEBOOK_PATH);
  return buildNotebookDTO(id);
});

/** reserve — เคลม lead_queue ที่ยังว่างให้ตัวเอง (port NotebookService::reserve) */
export const reserveNotebook = authedAction(async (user: SessionUser, id: number) => {
  const before = await findNotebookRow(id);
  if (!before) throw new Error('Notebook not found.');
  if (!canReserve(user, authFieldsOf(before))) {
    throw new ForbiddenError('Unauthorized: You do not have permission to reserve this notebook.');
  }
  if (!isLeadQueue(before)) throw new Error('Only lead queue notebooks can be reserved.');
  if (before.nbConvertedAt) throw new Error('This notebook lead has already been converted.');
  if (before.nbManageBy) throw new Error('This notebook lead has already been reserved.');

  const now = new Date();
  const set = {
    nbManageBy: user.userId,
    nbClaimedAt: now,
    updatedBy: user.userId,
    nbIsFreshQueue: deriveFreshQueue({
      nbConvertedAt: null,
      nbWorkflow: before.nbWorkflow,
      nbManageBy: user.userId,
      nbStatus: before.nbStatus,
      nbNextFollowupDate: before.nbNextFollowupDate,
      nbNextFollowupNote: before.nbNextFollowupNote,
    }),
    updatedAt: now,
  };
  // ponytail: conditional UPDATE = atomic claim แทน lockForUpdate; ถ้าต้อง isolation แน่น ค่อยห่อ db.transaction
  const res = await db
    .update(notebooks)
    .set(set)
    .where(and(eq(notebooks.id, id), isNull(notebooks.nbManageBy), isNull(notebooks.nbConvertedAt)));
  if (res[0].affectedRows === 0) throw new Error('This notebook lead has already been reserved.');

  const after = await findNotebookRow(id);
  if (after) {
    const { old, new: nw } = diffAttributes(before, after);
    if (Object.keys(nw).length > 0) {
      await recordHistory({ notebookId: id, action: 'reserved', oldValues: old, newValues: nw }, user);
    }
  }
  revalidatePath(NOTEBOOK_PATH);
  return buildNotebookDTO(id);
});

/** หา assignee ที่รับงานได้ (port resolveAssignableAssignee) */
async function loadAssignableAssignee(
  salesUserId: number,
  actingUser: SessionUser,
): Promise<{ userId: number; subRoleCodes: string[] }> {
  const [assignee] = await db
    .select({ userId: users.userId, enable: users.enable })
    .from(users)
    .where(
      and(
        eq(users.userId, salesUserId),
        eq(users.userIsEnable, true),
        eq(users.userIsDeleted, false),
      ),
    )
    .limit(1);

  // enable: null หรือ 'Y' เท่านั้น (เลียนเงื่อนไข whereNull/orWhere enable='Y')
  if (!assignee || (assignee.enable !== null && assignee.enable !== 'Y')) {
    throw new Error('Selected assignee is not available.');
  }

  const subRoleRows = await db
    .select({ code: masterSubRoles.msrCode })
    .from(userSubRoles)
    .innerJoin(masterSubRoles, eq(masterSubRoles.msrId, userSubRoles.usrSubRoleId))
    .where(and(eq(userSubRoles.usrUserId, salesUserId), eq(masterSubRoles.msrIsActive, true)));
  const codes = subRoleRows.map((r) => r.code);

  const has = (set: string[], code: string) => set.includes(code);
  const eligible =
    has(codes, SUB_ROLE.SALES_OFFLINE) ||
    has(codes, SUB_ROLE.SUPPORT_SALES) ||
    (has(actingUser.subRoleCodes, SUB_ROLE.SUPPORT_SALES) && has(codes, SUB_ROLE.HEAD_OFFLINE)) ||
    (has(actingUser.subRoleCodes, SUB_ROLE.HEAD_OFFLINE) &&
      salesUserId === actingUser.userId &&
      has(codes, SUB_ROLE.HEAD_OFFLINE));

  if (!eligible) {
    throw new Error(
      'Selected assignee must be an active SALES_OFFLINE, SUPPORT_SALES, or eligible HEAD_OFFLINE user.',
    );
  }
  return { userId: salesUserId, subRoleCodes: codes };
}

/** assign — มอบหมายหลาย notebook ให้ sales (port NotebookService::assignMany) */
export const assignNotebooks = authedAction(async (user: SessionUser, rawInput: BulkAssignInput) => {
  const input = bulkAssignSchema.parse(rawInput);
  const data = await assignNotebooksInternal(user, input.notebook_ids, input.sales_user_id);
  return { data, meta: { assigned_count: data.length } };
});

/** assign เดี่ยว (port NotebookService::assign → delegate assignMany) */
export const assignNotebook = authedAction(
  async (user: SessionUser, id: number, salesUserId: number) => {
    const input = assignSchema.parse({ sales_user_id: salesUserId });
    const result = await assignNotebooksInternal(user, [id], input.sales_user_id);
    return result[0] ?? null;
  },
);

/** core ของ assign ใช้ร่วม single/bulk (ไม่ห่อ authedAction ซ้ำ — caller ผ่าน auth แล้ว) */
async function assignNotebooksInternal(
  user: SessionUser,
  notebookIds: number[],
  salesUserId: number,
) {
  if (!canAssignNotebookQueue(user)) {
    throw new ForbiddenError('Unauthorized: You do not have permission to assign this notebook.');
  }
  const ids = [...new Set(notebookIds.filter((x) => x > 0))];
  if (ids.length === 0) throw new Error('Please select at least one notebook to assign.');
  const assignee = await loadAssignableAssignee(salesUserId, user);

  const rows = await db.select().from(notebooks).where(inArray(notebooks.id, ids));
  if (rows.length !== ids.length) throw new Error('Some selected notebooks were not found.');

  for (const before of rows) {
    if (before.nbConvertedAt) throw new Error('This notebook lead has already been converted.');
    if (before.nbEntryType === 'customer_care' || before.nbEntryType === 'personal_activity') {
      throw new Error('This notebook entry type cannot be assigned to a sales user.');
    }
  }
  for (const before of rows) {
    const isReassign = !!before.nbManageBy && before.nbManageBy !== assignee.userId;
    const set: Partial<typeof notebooks.$inferInsert> = {
      nbManageBy: assignee.userId,
      updatedBy: user.userId,
    };
    if (!before.nbClaimedAt) set.nbClaimedAt = new Date();
    await applyNotebookUpdate(before, set, { action: isReassign ? 'reassigned' : 'assigned', user });
  }
  revalidatePath(NOTEBOOK_PATH);
  return (await Promise.all(ids.map((id) => buildNotebookDTO(id)))).filter(Boolean);
}

/** convert — แปลง notebook เป็น customer (port NotebookService::convert) */
export const convertNotebook = authedAction(
  async (user: SessionUser, id: number, rawInput: ConvertInput = {}) => {
    const before = await findNotebookRow(id);
    if (!before) throw new Error('Notebook not found.');
    if (!canConvert(user, authFieldsOf(before))) {
      throw new ForbiddenError('Unauthorized: You do not have permission to convert this notebook.');
    }
    if (before.nbConvertedAt) throw new Error('Notebook has already been converted.');

    const input = convertSchema.parse(rawInput);
    let convertedCustomerId = input.customer_id ?? null;
    const leadPayload = parseJson(before.nbLeadPayload);
    if (!convertedCustomerId && isLeadQueue(before) && leadPayload && Object.keys(leadPayload).length > 0) {
      convertedCustomerId = await createCustomerFromLead(before, user);
    }

    const set: Partial<typeof notebooks.$inferInsert> = {
      nbConvertedAt: new Date(),
      updatedBy: user.userId,
    };
    if ('nb_status' in (rawInput as object)) set.nbStatus = input.nb_status ?? null;
    if (convertedCustomerId) set.nbConvertedCustomerId = convertedCustomerId;

    // ponytail: pre-check กัน double-convert ทั่วไปแล้ว; race ซ้อน (สร้าง customer ซ้ำ) โอกาสต่ำ ยอมรับได้
    await applyNotebookUpdate(before, set, { action: 'converted', user });

    revalidatePath(NOTEBOOK_PATH);
    return buildNotebookDTO(id);
  },
);

// ── Phase 3: customer care & personal activity ───────────────────────────────

const nowHHmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

type CareSnapshot = {
  customerName: string;
  contactPerson: string | null;
  contactNumber: string | null;
  email: string | null;
  isOnline: boolean;
};

/** snapshot ข้อมูลติดต่อจาก source ตอนสร้าง customer_care (port resolveCustomerCareSnapshot) */
async function resolveCustomerCareSnapshot(
  input: CreateCustomerCareInput,
  user: SessionUser,
): Promise<CareSnapshot> {
  if (input.source_type === 'customer') {
    const [c] = await db
      .select({
        cusChannel: masterCustomers.cusChannel,
        cusCompany: masterCustomers.cusCompany,
        cusFirstname: masterCustomers.cusFirstname,
        cusLastname: masterCustomers.cusLastname,
        cusName: masterCustomers.cusName,
        cusTel1: masterCustomers.cusTel1,
        cusEmail: masterCustomers.cusEmail,
      })
      .from(masterCustomers)
      .where(
        and(
          eq(masterCustomers.cusIsUse, 1),
          eq(masterCustomers.cusManageBy, user.userId),
          eq(masterCustomers.cusId, String(input.source_customer_id)),
        ),
      )
      .limit(1);
    if (!c) throw new Error('Selected customer source is not available.');

    const contactPerson = `${c.cusFirstname ?? ''} ${c.cusLastname ?? ''}`.trim();
    const customerName = String(c.cusCompany || c.cusName || contactPerson).trim();
    return {
      customerName: customerName !== '' ? customerName : '-',
      contactPerson: contactPerson !== '' ? contactPerson : c.cusName || customerName || null,
      contactNumber: c.cusTel1,
      email: c.cusEmail,
      isOnline: Number(c.cusChannel ?? 0) === 2,
    };
  }

  const [n] = await db
    .select({
      nbCustomerName: notebooks.nbCustomerName,
      nbIsOnline: notebooks.nbIsOnline,
      nbContactNumber: notebooks.nbContactNumber,
      nbEmail: notebooks.nbEmail,
      nbContactPerson: notebooks.nbContactPerson,
    })
    .from(notebooks)
    .where(
      and(
        eq(notebooks.nbManageBy, user.userId),
        eq(notebooks.nbEntryType, 'standard'),
        eq(notebooks.id, Number(input.source_notebook_id)),
      ),
    )
    .limit(1);
  if (!n) throw new Error('Selected notebook source is not available.');

  return {
    customerName: n.nbCustomerName || '-',
    contactPerson: n.nbContactPerson || n.nbCustomerName || null,
    contactNumber: n.nbContactNumber,
    email: n.nbEmail,
    isOnline: !!n.nbIsOnline,
  };
}

/** customer-care — สร้าง entry ดูแลลูกค้า (port NotebookService::createCustomerCare) */
export const createCustomerCareNotebook = authedAction(
  async (user: SessionUser, rawInput: CreateCustomerCareInput) => {
    if (!canCreateCustomerCare(user)) {
      throw new ForbiddenError('Unauthorized: You do not have permission to create customer care entries.');
    }
    const input = createCustomerCareSchema.parse(rawInput);
    const snapshot = await resolveCustomerCareSnapshot(input, user);

    const now = new Date();
    const inserted = await db.insert(notebooks).values({
      nbDate: input.nb_date,
      nbTime: nowHHmm(now),
      nbCustomerName: snapshot.customerName,
      nbIsOnline: snapshot.isOnline,
      nbAdditionalInfo: input.nb_additional_info ?? null,
      nbContactNumber: snapshot.contactNumber,
      nbEmail: snapshot.email,
      nbContactPerson: snapshot.contactPerson,
      nbAction: input.nb_action ?? null,
      nbStatus: input.nb_status ?? null,
      nbRemarks: input.nb_remarks ?? null,
      nbNextFollowupDate: input.nb_next_followup_date ?? null,
      nbNextFollowupNote: input.nb_next_followup_note ?? null,
      nbManageBy: user.userId,
      nbWorkflow: 'standard',
      nbEntryType: 'customer_care',
      nbSourceType: input.source_type,
      nbSourceCustomerId: input.source_type === 'customer' ? String(input.source_customer_id) : null,
      nbSourceNotebookId: input.source_type === 'notebook' ? Number(input.source_notebook_id) : null,
      nbIsFreshQueue: false,
      createdBy: user.userId,
      updatedBy: user.userId,
      createdAt: now,
      updatedAt: now,
    });
    const id = Number(inserted[0].insertId);
    const row = await findNotebookRow(id);
    await recordHistory(
      { notebookId: id, action: 'created', oldValues: null, newValues: row ? toNotebookAttributes(row) : null },
      user,
    );

    revalidatePath(NOTEBOOK_PATH);
    return buildNotebookDTO(id);
  },
);

/** personal — สร้างกิจกรรมส่วนตัว (port NotebookService::createPersonalActivity) */
export const createPersonalActivityNotebook = authedAction(
  async (user: SessionUser, rawInput: CreatePersonalActivityInput) => {
    const input = createPersonalActivitySchema.parse(rawInput);
    const now = new Date();
    const inserted = await db.insert(notebooks).values({
      nbDate: input.nb_date,
      nbTime: nowHHmm(now),
      nbCustomerName: 'ธุระส่วนตัว',
      nbIsOnline: false,
      nbAdditionalInfo: input.nb_additional_info,
      nbManageBy: user.userId,
      nbWorkflow: 'standard',
      nbEntryType: 'personal_activity',
      nbIsFreshQueue: false,
      createdBy: user.userId,
      updatedBy: user.userId,
      createdAt: now,
      updatedAt: now,
    });
    const id = Number(inserted[0].insertId);
    const row = await findNotebookRow(id);
    await recordHistory(
      { notebookId: id, action: 'created', oldValues: null, newValues: row ? toNotebookAttributes(row) : null },
      user,
    );

    revalidatePath(NOTEBOOK_PATH);
    return buildNotebookDTO(id);
  },
);

/** customer-care sources — ค้นหา customer/notebook ที่ใช้เป็นต้นทาง (read-only action, client trigger) */
export const searchCustomerCareSources = authedAction(
  async (user: SessionUser, rawInput: CustomerCareSourceFilters) => {
    if (!canCreateCustomerCare(user)) {
      throw new ForbiddenError('Unauthorized: You do not have permission to manage customer care entries.');
    }
    const input = customerCareSourceSchema.parse(rawInput);
    const page = input.page ?? 1;
    const perPage = input.per_page ?? 10;
    const search = (input.search ?? '').trim();
    const offset = (page - 1) * perPage;
    const meta = (total: number) => ({
      total,
      perPage,
      page,
      lastPage: Math.max(1, Math.ceil(total / perPage)),
    });

    if (input.source === 'customer') {
      const term = `%${search}%`;
      const where = and(
        eq(masterCustomers.cusIsUse, 1),
        eq(masterCustomers.cusManageBy, user.userId),
        search
          ? sql`(${masterCustomers.cusCompany} LIKE ${term} OR ${masterCustomers.cusName} LIKE ${term} OR ${masterCustomers.cusFirstname} LIKE ${term} OR ${masterCustomers.cusLastname} LIKE ${term} OR ${masterCustomers.cusTel1} LIKE ${term} OR ${masterCustomers.cusEmail} LIKE ${term})`
          : undefined,
      );
      const [countRow] = await db.select({ c: sql<number>`count(*)` }).from(masterCustomers).where(where);
      const rows = await db
        .select()
        .from(masterCustomers)
        .where(where)
        .orderBy(desc(masterCustomers.cusUpdatedDate), desc(masterCustomers.cusCreatedDate))
        .limit(perPage)
        .offset(offset);
      const data = rows.map((c) => ({
        cus_id: c.cusId,
        cus_channel: c.cusChannel,
        cus_company: c.cusCompany,
        cus_firstname: c.cusFirstname,
        cus_lastname: c.cusLastname,
        cus_name: c.cusName,
        cus_tel_1: c.cusTel1,
        cus_email: c.cusEmail,
        cus_manage_by: c.cusManageBy,
        cus_created_date: c.cusCreatedDate ? c.cusCreatedDate.toISOString() : null,
        cus_updated_date: c.cusUpdatedDate ? c.cusUpdatedDate.toISOString() : null,
      }));
      return { source: 'customer' as const, data, ...meta(Number(countRow?.c ?? 0)) };
    }

    const term = `%${search}%`;
    const where = and(
      eq(notebooks.nbManageBy, user.userId),
      eq(notebooks.nbEntryType, 'standard'),
      search
        ? sql`(${notebooks.nbCustomerName} LIKE ${term} OR ${notebooks.nbContactPerson} LIKE ${term} OR ${notebooks.nbContactNumber} LIKE ${term} OR ${notebooks.nbEmail} LIKE ${term})`
        : undefined,
    );
    const [countRow] = await db.select({ c: sql<number>`count(*)` }).from(notebooks).where(where);
    const rows = await db
      .select()
      .from(notebooks)
      .where(where)
      .orderBy(desc(notebooks.updatedAt))
      .limit(perPage)
      .offset(offset);
    const data = rows.map((n) => ({
      id: n.id,
      nb_date: n.nbDate,
      nb_customer_name: n.nbCustomerName,
      nb_is_online: n.nbIsOnline,
      nb_contact_number: n.nbContactNumber,
      nb_email: n.nbEmail,
      nb_contact_person: n.nbContactPerson,
      nb_manage_by: n.nbManageBy,
      created_at: n.createdAt ? n.createdAt.toISOString() : null,
      updated_at: n.updatedAt ? n.updatedAt.toISOString() : null,
    }));
    return { source: 'notebook' as const, data, ...meta(Number(countRow?.c ?? 0)) };
  },
);

// ── Phase 4: duplicate check ─────────────────────────────────────────────────

const dupCustomerCols = {
  cusId: masterCustomers.cusId,
  cusName: masterCustomers.cusName,
  cusCompany: masterCustomers.cusCompany,
  cusFirstname: masterCustomers.cusFirstname,
  cusLastname: masterCustomers.cusLastname,
  cusTel1: masterCustomers.cusTel1,
  cusTel2: masterCustomers.cusTel2,
  cusEmail: masterCustomers.cusEmail,
  cusManageBy: masterCustomers.cusManageBy,
} as const;

const dupNotebookCols = {
  id: notebooks.id,
  nbCustomerName: notebooks.nbCustomerName,
  nbContactPerson: notebooks.nbContactPerson,
  nbContactNumber: notebooks.nbContactNumber,
  nbEmail: notebooks.nbEmail,
  nbWorkflow: notebooks.nbWorkflow,
  nbEntryType: notebooks.nbEntryType,
  nbManageBy: notebooks.nbManageBy,
  updatedAt: notebooks.updatedAt,
} as const;

type DupCustomer = { [K in keyof typeof dupCustomerCols]: (typeof masterCustomers.$inferSelect)[K] };
type DupNotebook = { [K in keyof typeof dupNotebookCols]: (typeof notebooks.$inferSelect)[K] };

const stripPhone = (col: ReturnType<typeof sql>) =>
  sql`REPLACE(REPLACE(REPLACE(REPLACE(${col},'-',''),' ',''),'(',''),')','')`;
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** notebook ที่ไม่ใช่ personal_activity และยังไม่ converted (ฐานสำหรับ duplicate match) */
const dupNotebookBase = (extra: ReturnType<typeof sql> | undefined, excludeId: number | null) =>
  and(ne(notebooks.nbEntryType, 'personal_activity'), isNull(notebooks.nbConvertedAt), excludeId ? ne(notebooks.id, excludeId) : undefined, extra);

async function findDuplicateMatches(
  type: CheckDuplicateInput['type'],
  value: string,
  excludeId: number | null,
): Promise<{ customers: DupCustomer[]; notebooks: DupNotebook[] }> {
  const v = value.trim();
  const empty = { customers: [] as DupCustomer[], notebooks: [] as DupNotebook[] };
  if (v === '') return empty;

  if (type === 'phone') {
    const digits = v.replace(/[^0-9]/g, '');
    if (digits.length < 8) return empty;
    const customers = await db
      .select(dupCustomerCols)
      .from(masterCustomers)
      .where(
        and(
          eq(masterCustomers.cusIsUse, 1),
          sql`(${stripPhone(sql`${masterCustomers.cusTel1}`)} = ${digits} OR ${stripPhone(sql`${masterCustomers.cusTel2}`)} = ${digits})`,
        ),
      )
      .limit(5);
    const nbs = await db
      .select(dupNotebookCols)
      .from(notebooks)
      .where(dupNotebookBase(sql`${stripPhone(sql`${notebooks.nbContactNumber}`)} = ${digits}`, excludeId))
      .orderBy(desc(notebooks.updatedAt))
      .limit(5);
    return { customers, notebooks: nbs };
  }

  if (type === 'email') {
    const email = v.toLowerCase();
    if (!isEmail(email)) return empty;
    const customers = await db
      .select(dupCustomerCols)
      .from(masterCustomers)
      .where(and(eq(masterCustomers.cusIsUse, 1), sql`LOWER(TRIM(${masterCustomers.cusEmail})) = ${email}`))
      .limit(5);
    const nbs = await db
      .select(dupNotebookCols)
      .from(notebooks)
      .where(dupNotebookBase(sql`LOWER(TRIM(${notebooks.nbEmail})) = ${email}`, excludeId))
      .orderBy(desc(notebooks.updatedAt))
      .limit(5);
    return { customers, notebooks: nbs };
  }

  if (v.length < 3) return empty;
  const like = `%${v}%`;

  if (type === 'customer_name') {
    const customers = await db
      .select(dupCustomerCols)
      .from(masterCustomers)
      .where(
        and(
          eq(masterCustomers.cusIsUse, 1),
          sql`(${masterCustomers.cusName} LIKE ${like} OR ${masterCustomers.cusCompany} LIKE ${like})`,
        ),
      )
      .limit(5);
    const nbs = await db
      .select(dupNotebookCols)
      .from(notebooks)
      .where(dupNotebookBase(sql`${notebooks.nbCustomerName} LIKE ${like}`, excludeId))
      .orderBy(desc(notebooks.updatedAt))
      .limit(5);
    return { customers, notebooks: nbs };
  }

  // contact_person
  const customers = await db
    .select(dupCustomerCols)
    .from(masterCustomers)
    .where(
      and(
        eq(masterCustomers.cusIsUse, 1),
        sql`(CONCAT_WS(' ', ${masterCustomers.cusFirstname}, ${masterCustomers.cusLastname}) LIKE ${like} OR ${masterCustomers.cusFirstname} LIKE ${like} OR ${masterCustomers.cusLastname} LIKE ${like})`,
      ),
    )
    .limit(5);
  const nbs = await db
    .select(dupNotebookCols)
    .from(notebooks)
    .where(dupNotebookBase(sql`${notebooks.nbContactPerson} LIKE ${like}`, excludeId))
    .orderBy(desc(notebooks.updatedAt))
    .limit(5);
  return { customers, notebooks: nbs };
}

/** check-duplicate — หา customer/notebook ที่ซ้ำ (read-only action, port findDuplicateMatches) */
export const checkNotebookDuplicate = authedAction(
  async (_user: SessionUser, rawInput: CheckDuplicateInput) => {
    const input = checkDuplicateSchema.parse(rawInput);
    const excludeId = input.exclude_notebook_id ?? null;
    const { customers, notebooks: nbs } = await findDuplicateMatches(input.type, input.value, excludeId);

    const names = await loadUserMap([
      ...customers.map((c) => c.cusManageBy),
      ...nbs.map((n) => n.nbManageBy),
    ]);
    const nameOf = (id: number | null) => (id ? resolveUserDisplayName(names.get(id)) : null);

    return {
      type: input.type,
      value: input.value,
      customers: customers.map((c) => ({
        cus_id: c.cusId,
        cus_name: c.cusName,
        cus_company: c.cusCompany,
        cus_firstname: c.cusFirstname,
        cus_lastname: c.cusLastname,
        cus_tel_1: c.cusTel1,
        cus_tel_2: c.cusTel2,
        cus_email: c.cusEmail,
        sales_name: nameOf(c.cusManageBy),
      })),
      notebooks: nbs.map((n) => ({
        id: n.id,
        nb_customer_name: n.nbCustomerName,
        nb_contact_person: n.nbContactPerson,
        nb_contact_number: n.nbContactNumber,
        nb_email: n.nbEmail,
        nb_workflow: n.nbWorkflow,
        nb_entry_type: n.nbEntryType,
        nb_manage_by: n.nbManageBy,
        nb_manage_by_name: nameOf(n.nbManageBy),
        updated_at: n.updatedAt ? n.updatedAt.toISOString() : null,
      })),
    };
  },
);

// ── assignee picker (read action สำหรับ assign dialog) ───────────────────────

/**
 * รายชื่อ sales ที่รับงานได้ (active + มี sub-role SALES_OFFLINE/SUPPORT_SALES/HEAD_OFFLINE)
 * — assignNotebooks ตรวจ eligibility ต่อคนซ้ำอีกชั้น (loadAssignableAssignee) ตอนมอบหมายจริง
 */
export const listAssignableSalesUsers = authedAction(async (user: SessionUser) => {
  if (!canAssignNotebookQueue(user)) {
    throw new ForbiddenError('Unauthorized: You do not have permission to assign notebooks.');
  }
  const rows = await db
    .selectDistinct({
      userId: users.userId,
      username: users.username,
      userNickname: users.userNickname,
      userFirstname: users.userFirstname,
      userLastname: users.userLastname,
      role: users.role,
    })
    .from(users)
    .innerJoin(userSubRoles, eq(userSubRoles.usrUserId, users.userId))
    .innerJoin(masterSubRoles, eq(masterSubRoles.msrId, userSubRoles.usrSubRoleId))
    .where(
      and(
        eq(users.userIsEnable, true),
        eq(users.userIsDeleted, false),
        eq(masterSubRoles.msrIsActive, true),
        inArray(masterSubRoles.msrCode, [
          SUB_ROLE.SALES_OFFLINE,
          SUB_ROLE.SUPPORT_SALES,
          SUB_ROLE.HEAD_OFFLINE,
        ]),
      ),
    );

  // ภาระงานปัจจุบันต่อคน (ลีด standard ที่ยังไม่ converted) — โชว์ใน assign dialog
  const ids = [...new Set(rows.map((r) => r.userId))];
  const loadRows = ids.length
    ? await db
        .select({ uid: notebooks.nbManageBy, count: sql<number>`count(*)` })
        .from(notebooks)
        .where(
          and(
            inArray(notebooks.nbManageBy, ids),
            isNull(notebooks.nbConvertedAt),
            eq(notebooks.nbEntryType, 'standard'),
          ),
        )
        .groupBy(notebooks.nbManageBy)
    : [];
  const loadMap = new Map(loadRows.map((r) => [Number(r.uid), Number(r.count)]));

  return rows.map((r) => ({
    user_id: r.userId,
    name: resolveUserDisplayName(r) ?? String(r.userId),
    load: loadMap.get(r.userId) ?? 0,
  }));
});

// ── business types (read action สำหรับ dropdown "หมวดหมู่ธุรกิจ" ในฟอร์มลีด) ──

/** ประเภทธุรกิจที่ใช้งานอยู่ เรียงตาม bt_sort — เติม cus_bt_id ตอนสร้างลีด (port getAllBusinessTypes) */
export const listBusinessTypes = authedAction(async (_user: SessionUser) => {
  const rows = await db
    .select({ btId: masterBusinessTypes.btId, btName: masterBusinessTypes.btName })
    .from(masterBusinessTypes)
    .where(eq(masterBusinessTypes.btIsUse, 1))
    .orderBy(asc(masterBusinessTypes.btSort), asc(masterBusinessTypes.btName));
  return rows.map((r) => ({ bt_id: r.btId, bt_name: r.btName ?? '' }));
});
