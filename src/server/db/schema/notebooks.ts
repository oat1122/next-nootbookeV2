import {
  bigint,
  boolean,
  char,
  date,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * ตาราง `notebooks` — introspect จาก TNP MariaDB (migrate ฝั่ง Laravel แล้ว ดู
 * tnp-backend/database/migrations/2026_02_02_*..2026_04_29_*). ⚠️ ห้าม push/migrate
 *
 * หมายเหตุชนิดข้อมูล:
 * - DATE (`nb_date`, `nb_next_followup_date`) อ่านเป็น string 'YYYY-MM-DD' (pool ตั้ง dateStrings:['DATE'])
 *   เลี่ยง TZ drift — ไม่ต้องแปลงใน mapper
 * - `nb_lead_payload` เป็น JSON แต่ MariaDB เก็บเป็น longtext → mysql2 คืน "string" ตอนอ่าน
 *   ต้อง parse เองด้วย parseJson() (ดู @/server/notebook/mappers)
 * - `nb_manage_by` เป็น int (signed) ตาม migration เดิม ไม่ใช่ bigint
 */
export const notebooks = mysqlTable(
  'notebooks',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    nbDate: date('nb_date', { mode: 'string' }),
    nbTime: varchar('nb_time', { length: 255 }),
    nbCustomerName: varchar('nb_customer_name', { length: 255 }),
    nbIsOnline: boolean('nb_is_online').notNull().default(false),
    nbAdditionalInfo: text('nb_additional_info'),
    nbContactNumber: varchar('nb_contact_number', { length: 255 }),
    nbEmail: varchar('nb_email', { length: 255 }),
    nbContactPerson: varchar('nb_contact_person', { length: 255 }),
    nbAction: varchar('nb_action', { length: 255 }),
    nbStatus: varchar('nb_status', { length: 255 }),
    nbRemarks: text('nb_remarks'),
    nbNextFollowupDate: date('nb_next_followup_date', { mode: 'string' }),
    nbNextFollowupNote: text('nb_next_followup_note'),
    nbIsFavorite: boolean('nb_is_favorite').notNull().default(false),
    nbIsFreshQueue: boolean('nb_is_fresh_queue').notNull().default(false),
    nbManageBy: int('nb_manage_by'),
    nbWorkflow: varchar('nb_workflow', { length: 255 }).notNull().default('standard'),
    nbEntryType: varchar('nb_entry_type', { length: 255 }).notNull().default('standard'),
    nbSourceType: varchar('nb_source_type', { length: 255 }),
    nbSourceCustomerId: char('nb_source_customer_id', { length: 36 }),
    nbSourceNotebookId: bigint('nb_source_notebook_id', { mode: 'number' }),
    nbLeadPayload: json('nb_lead_payload'),
    nbClaimedAt: timestamp('nb_claimed_at'),
    nbConvertedAt: timestamp('nb_converted_at'),
    nbConvertedCustomerId: char('nb_converted_customer_id', { length: 36 }),
    createdBy: bigint('created_by', { mode: 'number' }),
    updatedBy: bigint('updated_by', { mode: 'number' }),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('idx_notebooks_workflow_queue').on(t.nbWorkflow, t.nbManageBy, t.nbConvertedAt),
    index('notebooks_nb_entry_type_idx').on(t.nbEntryType),
    index('notebooks_manage_by_created_at_idx').on(t.nbManageBy, t.createdAt),
  ],
);

/** ค่าคงที่ตรงกับ Notebook model ฝั่ง Laravel */
export const NB_WORKFLOW = { STANDARD: 'standard', LEAD_QUEUE: 'lead_queue' } as const;
export const NB_ENTRY_TYPE = {
  STANDARD: 'standard',
  CUSTOMER_CARE: 'customer_care',
  PERSONAL_ACTIVITY: 'personal_activity',
} as const;
export const NB_SOURCE_TYPE = { CUSTOMER: 'customer', NOTEBOOK: 'notebook' } as const;
