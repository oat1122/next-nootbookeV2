import {
  bigint,
  boolean,
  char,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * ตาราง `master_sub_roles` — sub-role ละเอียดเสริม users.role
 * (tnp-backend/database/migrations/2025_12_15_143000_create_master_sub_roles_table.php)
 * `msr_code` เช่น HEAD_OFFLINE / SUPPORT_SALES / TALESALES ใช้ตัดสินสิทธิ์ใน permissions.ts
 */
export const masterSubRoles = mysqlTable(
  'master_sub_roles',
  {
    msrId: char('msr_id', { length: 36 }).primaryKey(),
    msrCode: varchar('msr_code', { length: 50 }).notNull(),
    msrName: varchar('msr_name', { length: 100 }).notNull(),
    msrDescription: text('msr_description'),
    msrIsActive: boolean('msr_is_active').notNull().default(true),
    msrSort: int('msr_sort').notNull().default(0),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
    createdBy: bigint('created_by', { mode: 'number' }),
    updatedBy: bigint('updated_by', { mode: 'number' }),
  },
  (t) => [
    uniqueIndex('master_sub_roles_msr_code_unique').on(t.msrCode),
    index('idx_msr_is_active').on(t.msrIsActive),
  ],
);
