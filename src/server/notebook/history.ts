import 'server-only';
import { headers } from 'next/headers';
import { db } from '@/server/db/client';
import { notebookHistories } from '@/server/db/schema';
import type { SessionUser } from '@/server/auth';

type JsonValues = Record<string, unknown> | null;

type RecordHistoryInput = {
  notebookId: number;
  action: string;
  oldValues?: JsonValues;
  newValues?: JsonValues;
};

/**
 * เขียน audit log ลง notebook_histories (เลียน NotebookHistory ฝั่ง Laravel)
 * - ip_address/user_agent ดึงจาก request headers (truncate 255 ตามขนาดคอลัมน์)
 * - old_values/new_values เป็น json: drizzle stringify ให้, null → SQL NULL (ดู sql.cjs:182)
 * ออกแบบให้เรียกภายใน action ที่ผ่าน auth แล้ว (รับ SessionUser ตรง ๆ)
 */
export async function recordHistory(input: RecordHistoryInput, user: SessionUser): Promise<void> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0]?.trim() : null) || h.get('x-real-ip') || null;
  const ua = h.get('user-agent');

  await db.insert(notebookHistories).values({
    notebookId: input.notebookId,
    action: input.action,
    oldValues: input.oldValues ?? null,
    newValues: input.newValues ?? null,
    actionBy: user.userId || null,
    ipAddress: ip ? ip.slice(0, 255) : null,
    userAgent: ua ? ua.slice(0, 255) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
