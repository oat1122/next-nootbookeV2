import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import {
  customerDetails,
  masterCustomerGroups,
  masterCustomers,
  notebooks,
  relationCustomerUsers,
} from '@/server/db/schema';
import type { SessionUser } from '@/server/auth';
import { parseJson } from './mappers';

type NotebookRow = typeof notebooks.$inferSelect;
type Payload = Record<string, unknown>;

/**
 * พอร์ตขั้นต่ำของ CustomerService::createCustomer + buildCustomerPayloadFromLeadNotebook
 * ใช้โดย convertNotebook เมื่อ lead_queue มี nb_lead_payload → สร้างลูกค้าใหม่ แล้วคืน cus_id
 *
 * ponytail: ทำเฉพาะ insert ที่จำเป็น (master_customers + customer_details + relation)
 *  - ข้าม address component resolution (updateAddressFromComponents) → เก็บ cus_address จาก detail/raw + เก็บ pro/dis/sub/zip ดิบ
 *  - ข้าม customer_transfer_history (Laravel ห่อ try/catch "อย่าให้ล้มการสร้าง") + notification
 *  upgrade path: ถ้าต้อง history/notification/address-lookup ครบ ค่อย port AddressService + observers
 */

const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const digitsOnly = (v: unknown): string | null => {
  const s = str(v);
  return s == null ? null : s.replace(/[^0-9]/g, '');
};

/** gen cus_no รูปแบบ YYYY + running 6 หลัก (port genCustomerNo) */
function genCustomerNo(lastNo: string | null): string {
  const yearStr = String(new Date().getFullYear());
  let nextId = 1;
  if (lastNo) {
    const lastYear = lastNo.slice(0, 4);
    const lastId = parseInt(lastNo.slice(4), 10) || 0;
    nextId = lastYear === yearStr ? lastId + 1 : 1;
  }
  return yearStr + String(nextId).padStart(6, '0');
}

/** recall datetime = now + "<n> day" ตั้งเวลา 23:59:59 (port setRecallDatetime) */
function recallDatetime(def: string | null): string {
  const days = parseInt((def ?? '').match(/\d+/)?.[0] ?? '0', 10);
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 23:59:59`;
}

/** สร้าง payload ลูกค้าจาก lead notebook (port buildCustomerPayloadFromLeadNotebook) */
function buildCustomerPayload(nb: NotebookRow): Payload {
  const payload: Payload = parseJson(nb.nbLeadPayload) ?? {};
  let firstName = String(payload.cus_firstname ?? '').trim();
  let lastName = String(payload.cus_lastname ?? '').trim();
  const contactPerson = String(nb.nbContactPerson ?? '').trim();

  if (firstName === '' && contactPerson !== '') {
    const parts = contactPerson.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? nb.nbCustomerName ?? '-';
    lastName = lastName !== '' ? lastName : parts.slice(1).join(' ').trim();
  }

  const company = String(payload.cus_company ?? nb.nbCustomerName ?? '').trim();
  const customerName = String((payload.cus_name ?? contactPerson) || nb.nbCustomerName || '').trim();

  return {
    ...payload,
    cus_channel: payload.cus_channel ?? (nb.nbIsOnline ? 2 : 1),
    cus_company: company !== '' ? company : customerName !== '' ? customerName : '-',
    cus_name: customerName !== '' ? customerName : company !== '' ? company : '-',
    cus_firstname: firstName !== '' ? firstName : customerName !== '' ? customerName : '-',
    cus_lastname: lastName !== '' ? lastName : '-',
    cus_tel_1: payload.cus_tel_1 ?? nb.nbContactNumber,
    cus_email: payload.cus_email ?? nb.nbEmail,
    cd_note: payload.cd_note ?? nb.nbAdditionalInfo,
    cus_source: payload.cus_source ?? 'telesales',
    cus_allocation_status: 'allocated',
    cus_manage_by: nb.nbManageBy,
    cus_allocated_by: nb.createdBy,
  };
}

/** default group เกรด D (mcg_sort=4) fallback เกรดต่ำสุด (port getDefaultCustomerGroup) */
async function getDefaultGroup(): Promise<{ mcgId: string; mcgRecallDefault: string | null }> {
  const [d] = await db
    .select({ mcgId: masterCustomerGroups.mcgId, mcgRecallDefault: masterCustomerGroups.mcgRecallDefault })
    .from(masterCustomerGroups)
    .where(and(eq(masterCustomerGroups.mcgIsUse, 1), eq(masterCustomerGroups.mcgSort, 4)))
    .limit(1);
  if (d) return d;

  const [fallback] = await db
    .select({ mcgId: masterCustomerGroups.mcgId, mcgRecallDefault: masterCustomerGroups.mcgRecallDefault })
    .from(masterCustomerGroups)
    .where(eq(masterCustomerGroups.mcgIsUse, 1))
    .orderBy(desc(masterCustomerGroups.mcgSort))
    .limit(1);
  if (!fallback) throw new Error('No active customer group found to assign default grade.');
  return fallback;
}

/** สร้างลูกค้าใหม่จาก lead notebook → คืน cus_id */
export async function createCustomerFromLead(nb: NotebookRow, user: SessionUser): Promise<string> {
  const payload = buildCustomerPayload(nb);
  const group = await getDefaultGroup();

  const [maxRow] = await db.select({ m: sql<string | null>`MAX(${masterCustomers.cusNo})` }).from(masterCustomers);
  const cusNo = genCustomerNo(maxRow?.m ?? null);

  const allocationStatus = (payload.cus_allocation_status as 'pool' | 'allocated') ?? 'allocated';
  const manageBy = allocationStatus === 'pool' ? null : typeof payload.cus_manage_by === 'number' ? payload.cus_manage_by : null;
  const allocatedBy = typeof payload.cus_allocated_by === 'number' ? payload.cus_allocated_by : user.userId;
  const now = new Date();
  const cusId = randomUUID();
  const address = str(payload.cus_address_detail) ?? str(payload.cus_address);
  const channel = Number(payload.cus_channel);

  await db.insert(masterCustomers).values({
    cusId,
    cusMcgId: group.mcgId,
    cusNo,
    cusChannel: Number.isFinite(channel) ? channel : null,
    cusSource: (str(payload.cus_source) as 'sales' | 'telesales' | 'online' | 'office') ?? 'telesales',
    cusAllocationStatus: allocationStatus,
    cusAllocatedBy: allocatedBy,
    cusAllocatedAt: allocationStatus === 'pool' ? null : now,
    cusBtId: str(payload.cus_bt_id),
    cusFirstname: str(payload.cus_firstname),
    cusLastname: str(payload.cus_lastname),
    cusName: str(payload.cus_name),
    cusDepart: str(payload.cus_depart),
    cusCompany: str(payload.cus_company),
    cusTel1: digitsOnly(payload.cus_tel_1),
    cusTel2: digitsOnly(payload.cus_tel_2),
    cusEmail: str(payload.cus_email),
    cusTaxId: digitsOnly(payload.cus_tax_id),
    cusProId: str(payload.cus_pro_id),
    cusDisId: str(payload.cus_dis_id),
    cusSubId: str(payload.cus_sub_id),
    cusZipCode: str(payload.cus_zip_code),
    cusAddress: address,
    cusManageBy: manageBy,
    cusIsUse: 1,
    cusCreatedDate: now,
    cusCreatedBy: user.userId,
    cusUpdatedDate: now,
    cusUpdatedBy: user.userId,
  });

  await db.insert(customerDetails).values({
    cdId: randomUUID(),
    cdCusId: cusId,
    cdLastDatetime: recallDatetime(group.mcgRecallDefault),
    cdNote: str(payload.cd_note)?.slice(0, 255) ?? null,
    cdRemark: str(payload.cd_remark),
    cdIsUse: 1,
    cdCreatedDate: now,
    cdCreatedBy: user.userId,
    cdUpdatedDate: now,
    cdUpdatedBy: user.userId,
  });

  if (allocationStatus === 'allocated' && manageBy) {
    await db.insert(relationCustomerUsers).values({
      rcsId: randomUUID(),
      rcsCusId: cusId,
      rcsUserId: manageBy,
      rcsIsUse: 1,
      rcsCreatedDate: now,
      rcsUpdatedDate: now,
    });
  }

  return cusId;
}
