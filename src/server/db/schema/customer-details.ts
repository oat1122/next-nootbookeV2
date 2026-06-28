import { bigint, char, datetime, int, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';

/** ตาราง `customer_details` — รายละเอียด/recall ของลูกค้า (สร้างคู่กับ master_customers ตอน convert) */
export const customerDetails = mysqlTable('customer_details', {
  cdId: char('cd_id', { length: 36 }).primaryKey(),
  cdCusId: char('cd_cus_id', { length: 36 }),
  cdLastDatetime: datetime('cd_last_datetime', { mode: 'string' }),
  cdNote: varchar('cd_note', { length: 255 }),
  cdRemark: text('cd_remark'),
  cdIsUse: int('cd_is_use').notNull().default(1),
  cdCreatedDate: timestamp('cd_created_date'),
  cdCreatedBy: bigint('cd_created_by', { mode: 'number' }),
  cdUpdatedDate: timestamp('cd_updated_date'),
  cdUpdatedBy: bigint('cd_updated_by', { mode: 'number' }),
});
