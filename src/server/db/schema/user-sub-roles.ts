import { bigint, char, index, mysqlTable, timestamp, uniqueIndex } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/**
 * pivot `user_sub_roles` — ผูก users กับ master_sub_roles (many-to-many)
 * (tnp-backend/database/migrations/2025_12_15_143100_create_user_sub_roles_table.php)
 * หมายเหตุ: ตารางนี้มีแค่ created_at ไม่มี updated_at
 */
export const userSubRoles = mysqlTable(
  'user_sub_roles',
  {
    usrId: char('usr_id', { length: 36 }).primaryKey(),
    usrUserId: bigint('usr_user_id', { mode: 'number' }).notNull(),
    usrSubRoleId: char('usr_sub_role_id', { length: 36 }).notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    createdBy: bigint('created_by', { mode: 'number' }),
  },
  (t) => [
    uniqueIndex('unique_user_sub_role').on(t.usrUserId, t.usrSubRoleId),
    index('idx_usr_user_id').on(t.usrUserId),
  ],
);
