// Drizzle schema — Notebook v2 (foundation)
// เก็บเฉพาะตารางที่ชั้น auth ต้องใช้ (คัดมาจาก E:\next-accountV2 ซึ่งคัดจาก TNP-FormHelpers)
// ⚠️ DB เป็นของ Laravel/NestJS ร่วมกัน — ใช้ drizzle-kit แค่ introspect ห้าม push/migrate
// โดเมนของ notebook (ตารางใหม่) ต้องเป็น Laravel migration ฝั่ง tnp-backend ก่อน แล้วค่อย introspect มา

// auth / users
export * from './users';
export * from './personal-access-tokens';
export * from './master-sub-roles';
export * from './user-sub-roles';

// notebook domain
export * from './notebooks';
export * from './notebook-histories';

// customer domain (เฉพาะที่ notebook ต้องใช้: convert / duplicate-check / customer-care source)
export * from './master-customers';
export * from './customer-details';
export * from './master-customer-groups';
export * from './relation-customer-users';
export * from './recall-action-logs';
