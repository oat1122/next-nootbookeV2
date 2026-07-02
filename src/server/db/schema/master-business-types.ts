import { char, int, mysqlTable, timestamp, tinyint, varchar } from 'drizzle-orm/mysql-core';

/**
 * ตาราง `master_business_types` — หมวดหมู่/ประเภทธุรกิจของลูกค้า (master_customers.cus_bt_id → bt_id)
 * introspect จาก TNP MariaDB (Laravel migration 2025_06_13_104715) — ⚠️ ห้าม push/migrate
 */
export const masterBusinessTypes = mysqlTable('master_business_types', {
  btId: char('bt_id', { length: 36 }).primaryKey(),
  btName: varchar('bt_name', { length: 255 }),
  btSort: int('bt_sort'),
  btIsUse: tinyint('bt_is_use').notNull().default(1),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});
