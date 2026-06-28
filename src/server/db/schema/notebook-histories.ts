import { bigint, index, json, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

/**
 * ตาราง `notebook_histories` — audit log ทุก mutation ของ notebook
 * (tnp-backend/database/migrations/2026_02_03_172146_create_notebook_histories_table.php)
 * `old_values`/`new_values` เป็น JSON (MariaDB longtext) → ต้อง parseJson() ตอนอ่าน
 */
export const notebookHistories = mysqlTable(
  'notebook_histories',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    notebookId: bigint('notebook_id', { mode: 'number' }).notNull(),
    action: varchar('action', { length: 255 }).notNull(),
    oldValues: json('old_values'),
    newValues: json('new_values'),
    actionBy: bigint('action_by', { mode: 'number' }),
    ipAddress: varchar('ip_address', { length: 255 }),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('notebook_histories_notebook_id_index').on(t.notebookId),
    index('notebook_histories_action_by_index').on(t.actionBy),
  ],
);

/** action ของ history ตรงกับ Laravel */
export const NB_HISTORY_ACTION = {
  CREATED: 'created',
  CREATED_TO_QUEUE: 'created_to_queue',
  CREATED_TO_MINE: 'created_to_mine',
  CUSTOMER_INFO_UPDATED: 'customer_info_updated',
  RESERVED: 'reserved',
  ASSIGNED: 'assigned',
  REASSIGNED: 'reassigned',
  CONVERTED: 'converted',
} as const;
