import { char, int, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

/** ตาราง `master_customer_groups` — เกรดลูกค้า (default grade D, ใช้ recall_default ตอน convert) */
export const masterCustomerGroups = mysqlTable('master_customer_groups', {
  mcgId: char('mcg_id', { length: 36 }).primaryKey(),
  mcgName: varchar('mcg_name', { length: 255 }),
  mcgRemark: varchar('mcg_remark', { length: 255 }),
  mcgRecallDefault: varchar('mcg_recall_default', { length: 255 }),
  mcgSort: int('mcg_sort'),
  mcgIsUse: int('mcg_is_use').notNull().default(1),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});
