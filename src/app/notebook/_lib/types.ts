import type { NotebookDTO } from '@/server/notebook/mappers';

/** DTO ของ notebook ที่มี histories (list ดึง include=histories เสมอ → ใช้ branch นี้) */
export type NotebookItem = Extract<NotebookDTO, { histories: unknown }>;
export type NotebookHistoryItem = NotebookItem['histories'][number];

/** สิทธิ์ที่ส่งจาก server → client islands (serializable, กัน import server-only ฝั่ง client) */
export type NotebookPerms = {
  userId: number;
  role: string;
  canManageAll: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canReserve: boolean;
  canCreateStandard: boolean;
  canCreateLeadMine: boolean;
  canCreateLeadQueue: boolean;
  canCreateCare: boolean;
  canCreatePersonal: boolean;
};

export type Scope = 'mine' | 'all' | 'queue';
export type EntryType = 'all' | 'standard' | 'customer_care' | 'personal_activity';
export type ViewMode = 'table' | 'card';

export const SCOPE_LABEL: Record<Scope, string> = {
  mine: 'ลูกค้าของฉัน',
  all: 'ทั้งหมด',
  queue: 'คิวกลาง',
};

export const ENTRY_LABEL: Record<EntryType, string> = {
  all: 'ทุกชนิด',
  standard: 'ลูกค้า/ลีด',
  customer_care: 'ดูแลลูกค้า',
  personal_activity: 'ธุระส่วนตัว',
};
