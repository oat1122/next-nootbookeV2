import { bigint, boolean, char, datetime, int, mysqlTable, text, timestamp } from 'drizzle-orm/mysql-core';

/** ตาราง `recall_action_logs` — log การโทร recall ลูกค้า (ใช้ใน notebook self-report) */
export const recallActionLogs = mysqlTable('recall_action_logs', {
  id: char('id', { length: 36 }).primaryKey(),
  customerId: char('customer_id', { length: 36 }).notNull(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  previousDatetime: datetime('previous_datetime', { mode: 'string' }),
  newDatetime: datetime('new_datetime', { mode: 'string' }).notNull(),
  recallNote: text('recall_note'),
  customerGroupId: char('customer_group_id', { length: 36 }),
  wasOverdue: boolean('was_overdue').notNull(),
  daysOverdue: int('days_overdue').notNull(),
  createdAt: timestamp('created_at').notNull(),
});
