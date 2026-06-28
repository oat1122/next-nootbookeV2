import {
  bigint,
  boolean,
  char,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const users = mysqlTable('users', {
  userId: bigint('user_id', { mode: 'number' }).primaryKey().autoincrement(),
  userUuid: char('user_uuid', { length: 36 }).notNull().default('uuid()'),
  username: varchar('username', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  role: mysqlEnum('role', [
    'admin',
    'manager',
    'production',
    'graphic',
    'sale',
    'technician',
    'account',
    'telesale',
  ]).notNull(),
  userEmpNo: varchar('user_emp_no', { length: 20 }),
  userFirstname: varchar('user_firstname', { length: 50 }),
  userLastname: varchar('user_lastname', { length: 50 }),
  userPhone: varchar('user_phone', { length: 50 }),
  userNickname: varchar('user_nickname', { length: 50 }),
  userPosition: varchar('user_position', { length: 100 }),
  enable: mysqlEnum('enable', ['Y', 'N']).notNull().default('Y'),
  userIsEnable: boolean('user_is_enable').notNull().default(true),
  deleted: int('deleted').notNull().default(0),
  userIsDeleted: boolean('user_is_deleted').notNull().default(false),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
  newPass: varchar('new_pass', { length: 255 }),
  passIsUpdated: boolean('pass_is_updated').default(false),
  userCreatedDate: timestamp('user_created_date').default(sql`CURRENT_TIMESTAMP`),
  userCreatedBy: char('user_created_by', { length: 36 }),
  userUpdatedDate: timestamp('user_updated_date')
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
  userUpdatedBy: char('user_updated_by', { length: 36 }),
});
