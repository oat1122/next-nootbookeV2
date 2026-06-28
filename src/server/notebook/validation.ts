import { z } from 'zod';

/**
 * Zod schemas พอร์ตจาก FormRequest ฝั่ง Laravel (app/Http/Requests/V1/Notebook)
 * แทน rules() ของแต่ละ request — ใช้ .parse() ใน actions/queries
 *
 * แมปกฎ Laravel → Zod:
 *  required → field บังคับ · nullable → .nullable().optional() · sometimes → .optional()
 *  max:n(string) → .max(n) · email → z.email() · integer → z.number().int() · in:[..] → z.enum
 *  rule `exists` (เช็คมีในตาราง) ไม่พอร์ตที่ schema — ตรวจตอน query/insert จริง (FK + lookup ใน action)
 */

/** date แบบหลวมเหมือน Laravel `date` (parse ได้พอ) */
const zDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'invalid date' });

// ── Phase 1: CRUD + index ───────────────────────────────────────────────────

export const createNotebookSchema = z.object({
  nb_customer_name: z.string().min(1).max(255),
  nb_date: zDate.nullable().optional(),
  nb_time: z.string().max(255).nullable().optional(),
  nb_is_online: z.boolean().optional(),
  nb_additional_info: z.string().nullable().optional(),
  nb_contact_number: z.string().max(255).nullable().optional(),
  nb_email: z.email().max(255).nullable().optional(),
  nb_contact_person: z.string().max(255).nullable().optional(),
  nb_action: z.string().max(255).nullable().optional(),
  nb_status: z.string().max(255).nullable().optional(),
  nb_remarks: z.string().nullable().optional(),
  nb_next_followup_date: zDate.nullable().optional(),
  nb_next_followup_note: z.string().nullable().optional(),
  nb_workflow: z.enum(['standard', 'lead_queue']).optional(),
  // อนุญาตเฉพาะ canManageAllNotebooks — action จะ strip ทิ้งถ้าไม่มีสิทธิ์
  nb_manage_by: z.number().int().nullable().optional(),
});
export type CreateNotebookInput = z.infer<typeof createNotebookSchema>;

export const updateNotebookSchema = z.object({
  nb_customer_name: z.string().max(255).optional(),
  nb_date: zDate.nullable().optional(),
  nb_time: z.string().max(255).nullable().optional(),
  nb_is_online: z.boolean().optional(),
  nb_additional_info: z.string().nullable().optional(),
  nb_contact_number: z.string().max(255).nullable().optional(),
  nb_email: z.email().max(255).nullable().optional(),
  nb_contact_person: z.string().max(255).nullable().optional(),
  nb_action: z.string().max(255).nullable().optional(),
  nb_status: z.string().max(255).nullable().optional(),
  nb_remarks: z.string().nullable().optional(),
  nb_next_followup_date: zDate.nullable().optional(),
  nb_next_followup_note: z.string().nullable().optional(),
  nb_is_favorite: z.boolean().optional(),
  _history_action: z.enum(['customer_info_updated']).optional(),
  nb_manage_by: z.number().int().nullable().optional(),
});
export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>;

export const indexFiltersSchema = z.object({
  search: z.string().max(255).nullable().optional(),
  start_date: zDate.nullable().optional(),
  end_date: zDate.nullable().optional(),
  date_filter_by: z.enum(['nb_date', 'created_at', 'updated_at', 'all']).nullable().optional(),
  status: z.string().max(255).nullable().optional(),
  action: z.string().max(255).nullable().optional(),
  entry_type: z.enum(['all', 'standard', 'customer_care', 'personal_activity']).nullable().optional(),
  manage_by: z.number().int().min(1).nullable().optional(),
  scope: z.enum(['all', 'mine', 'queue']).nullable().optional(),
  workflow: z.enum(['standard', 'lead_queue']).nullable().optional(),
  include: z.string().nullable().optional(),
  paginate: z.boolean().optional(),
  per_page: z.number().int().min(1).max(100).nullable().optional(),
});
export type IndexFilters = z.infer<typeof indexFiltersSchema>;

// ── Phase 2: lead queue / convert / assign ──────────────────────────────────

export const createLeadSchema = z.object({
  cus_channel: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  target_scope: z.enum(['queue', 'mine']).nullable().optional(),
  cus_company: z.string().max(255).nullable().optional(),
  cus_name: z.string().min(1).max(255),
  cus_firstname: z.string().min(1).max(255),
  cus_lastname: z.string().min(1).max(255),
  cus_tel_1: z.string().min(1).max(20),
  cus_tel_2: z.string().max(20).nullable().optional(),
  cus_email: z.email().max(100).nullable().optional(),
  cus_tax_id: z.string().max(13).nullable().optional(),
  cus_bt_id: z.string().max(36).nullable().optional(),
  cus_depart: z.string().max(255).nullable().optional(),
  cus_address: z.string().nullable().optional(),
  cus_address_detail: z.string().max(500).nullable().optional(),
  cus_zip_code: z.string().max(10).nullable().optional(),
  cus_pro_id: z.any().optional(),
  cus_dis_id: z.any().optional(),
  cus_sub_id: z.any().optional(),
  cd_note: z.string().max(2000).nullable().optional(),
  cd_remark: z.string().max(1000).nullable().optional(),
  is_possible_duplicate: z.boolean().optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const convertSchema = z.object({
  nb_status: z.string().max(255).nullable().optional(),
  customer_id: z.string().max(36).nullable().optional(),
});
export type ConvertInput = z.infer<typeof convertSchema>;

export const assignSchema = z.object({
  sales_user_id: z.number().int(),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const bulkAssignSchema = z.object({
  notebook_ids: z.array(z.number().int()).min(1),
  sales_user_id: z.number().int(),
});
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;

// ── Phase 3: customer care / personal activity ──────────────────────────────

export const createCustomerCareSchema = z
  .object({
    nb_date: zDate,
    nb_additional_info: z.string().nullable().optional(),
    nb_action: z.string().max(255).nullable().optional(),
    nb_status: z.string().max(255).nullable().optional(),
    nb_remarks: z.string().nullable().optional(),
    nb_next_followup_date: zDate.nullable().optional(),
    nb_next_followup_note: z.string().nullable().optional(),
    source_type: z.enum(['customer', 'notebook']),
    source_customer_id: z.string().max(36).nullable().optional(),
    source_notebook_id: z.number().int().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.source_type === 'customer' && !val.source_customer_id) {
      ctx.addIssue({ code: 'custom', path: ['source_customer_id'], message: 'The source customer field is required.' });
    }
    if (val.source_type === 'notebook' && !val.source_notebook_id) {
      ctx.addIssue({ code: 'custom', path: ['source_notebook_id'], message: 'The source notebook field is required.' });
    }
  });
export type CreateCustomerCareInput = z.infer<typeof createCustomerCareSchema>;

export const createPersonalActivitySchema = z.object({
  nb_date: zDate,
  nb_additional_info: z.string().min(1),
});
export type CreatePersonalActivityInput = z.infer<typeof createPersonalActivitySchema>;

export const customerCareSourceSchema = z.object({
  source: z.enum(['customer', 'notebook']),
  search: z.string().max(255).nullable().optional(),
  page: z.number().int().min(1).nullable().optional(),
  per_page: z.number().int().min(1).max(50).nullable().optional(),
});
export type CustomerCareSourceFilters = z.infer<typeof customerCareSourceSchema>;

// ── Phase 4: duplicate check ────────────────────────────────────────────────

export const checkDuplicateSchema = z.object({
  type: z.enum(['phone', 'email', 'customer_name', 'contact_person']),
  value: z.string().min(1).max(255),
  exclude_notebook_id: z.number().int().min(1).nullable().optional(),
});
export type CheckDuplicateInput = z.infer<typeof checkDuplicateSchema>;

// ── Phase 5: KPI / self-report ──────────────────────────────────────────────

const periodEnum = z.enum([
  'today',
  'week',
  'month',
  'quarter',
  'year',
  'custom',
  'prev_month',
  'prev_week',
  'prev_quarter',
]);
const sourceFilterEnum = z.enum(['telesales', 'sales', 'online', 'office', 'all']);

export const kpiSummarySchema = z.object({
  period: periodEnum.nullable().optional(),
  start_date: zDate.nullable().optional(),
  end_date: zDate.nullable().optional(),
  source_filter: sourceFilterEnum.nullable().optional(),
  user_id: z.number().int().nullable().optional(),
  nb_status: z.string().nullable().optional(),
});
export type KpiSummaryParams = z.infer<typeof kpiSummarySchema>;

export const kpiDetailsSchema = kpiSummarySchema; // details ใช้กฎเดียวกัน (user_id ใช้ได้ทั้ง id/null)
export type KpiDetailsParams = z.infer<typeof kpiDetailsSchema>;

export const allTabStatsSchema = z
  .object({
    search: z.string().max(255).nullable().optional(),
    start_date: zDate.nullable().optional(),
    end_date: zDate.nullable().optional(),
    date_filter_by: z.enum(['nb_date', 'created_at', 'updated_at', 'all']).nullable().optional(),
    status: z.string().max(255).nullable().optional(),
    action: z.string().max(255).nullable().optional(),
    entry_type: z.string().max(50).nullable().optional(),
    manage_by: z.number().int().nullable().optional(),
  })
  .refine(
    (v) => !v.start_date || !v.end_date || Date.parse(v.end_date) >= Date.parse(v.start_date),
    { path: ['end_date'], message: 'end_date must be after_or_equal start_date' },
  );
export type AllTabStatsFilters = z.infer<typeof allTabStatsSchema>;

/** self-report ใช้ start_date/end_date เป็นหลัก (เลียน NotebookIndexRequest subset) */
export const selfReportSchema = z.object({
  start_date: zDate.nullable().optional(),
  end_date: zDate.nullable().optional(),
  include: z.string().nullable().optional(),
});
export type SelfReportFilters = z.infer<typeof selfReportSchema>;
