import {
  bigint,
  char,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * ตาราง `master_customers` — introspect จาก TNP MariaDB (เป็นของ customer domain เดิม)
 * ใช้เฉพาะ path ที่ notebook ต้อง: convert (สร้าง customer), duplicate-check, customer-care source
 * ⚠️ ห้าม push/migrate — ตารางนี้ Laravel/NestJS เป็นเจ้าของ
 */
export const masterCustomers = mysqlTable('master_customers', {
  cusId: char('cus_id', { length: 36 }).primaryKey(),
  cusMcgId: char('cus_mcg_id', { length: 36 }),
  cusNo: char('cus_no', { length: 10 }),
  cusChannel: tinyint('cus_channel'),
  cusSource: mysqlEnum('cus_source', ['sales', 'telesales', 'online', 'office'])
    .notNull()
    .default('sales'),
  cusAllocationStatus: mysqlEnum('cus_allocation_status', ['pool', 'allocated'])
    .notNull()
    .default('allocated'),
  cusAllocatedBy: bigint('cus_allocated_by', { mode: 'number' }),
  cusAllocatedAt: timestamp('cus_allocated_at'),
  cusBtId: char('cus_bt_id', { length: 36 }),
  cusFirstname: varchar('cus_firstname', { length: 100 }),
  cusLastname: varchar('cus_lastname', { length: 100 }),
  cusName: varchar('cus_name', { length: 100 }),
  cusDepart: varchar('cus_depart', { length: 100 }),
  cusCompany: varchar('cus_company', { length: 255 }),
  cusTel1: char('cus_tel_1', { length: 20 }),
  cusTel2: char('cus_tel_2', { length: 20 }),
  cusEmail: varchar('cus_email', { length: 100 }),
  cusTaxId: char('cus_tax_id', { length: 13 }),
  cusProId: char('cus_pro_id', { length: 36 }),
  cusDisId: char('cus_dis_id', { length: 36 }),
  cusSubId: char('cus_sub_id', { length: 36 }),
  cusZipCode: char('cus_zip_code', { length: 5 }),
  cusAddress: text('cus_address'),
  cusManageBy: bigint('cus_manage_by', { mode: 'number' }),
  cusIsUse: int('cus_is_use').notNull().default(1),
  cusCreatedDate: timestamp('cus_created_date'),
  cusCreatedBy: bigint('cus_created_by', { mode: 'number' }),
  cusUpdatedDate: timestamp('cus_updated_date'),
  cusUpdatedBy: bigint('cus_updated_by', { mode: 'number' }),
});
