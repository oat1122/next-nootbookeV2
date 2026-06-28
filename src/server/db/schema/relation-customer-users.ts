import { bigint, char, int, mysqlTable, timestamp } from 'drizzle-orm/mysql-core';

/** pivot `relation_customer_users` — ผูกลูกค้ากับ sales (สร้างตอน convert ถ้า allocated + มี manage_by) */
export const relationCustomerUsers = mysqlTable('relation_customer_users', {
  rcsId: char('rcs_id', { length: 36 }).primaryKey(),
  rcsCusId: char('rcs_cus_id', { length: 36 }),
  rcsUserId: bigint('rcs_user_id', { mode: 'number' }),
  rcsIsUse: int('rcs_is_use').notNull().default(1),
  rcsCreatedDate: timestamp('rcs_created_date'),
  rcsUpdatedDate: timestamp('rcs_updated_date'),
});
