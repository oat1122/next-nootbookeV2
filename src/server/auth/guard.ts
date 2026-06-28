import 'server-only';
import { requireUser } from './session';
import { requireRole } from './rbac';
import type { Role, SessionUser } from './verify-token';

/**
 * ห่อ Server Action ให้ "ลืมเช็คสิทธิ์ไม่ได้" — ปิดช่องโหว่ F1 (docesacc/audit/01)
 *
 * proxy/layout กันได้แค่ "หน้า" เท่านั้น. Server Action / Route Handler ถูกเรียกตรงแบบ POST
 * ไปยัง route ที่มันอยู่ — **ไม่ผ่าน layout** จึงไม่ได้ถูก requireUser() อัตโนมัติ
 * (ยืนยันใน node_modules/next/dist/docs/.../proxy.md:217-219 ที่ระบุเองว่า
 *  "verify authentication and authorization INSIDE each Server Function").
 *
 * กฎเหล็ก: ทุก mutation action ต้องห่อด้วย helper นี้ — บรรทัดแรกจะเรียก requireUser() ให้เอง
 * แล้วส่ง SessionUser เป็นอาร์กิวเมนต์ตัวแรกของ handler. ถ้าระบุ role จะ requireRole() ต่อ
 * (ไม่ผ่าน → โยน ForbiddenError)
 *
 * @example
 * 'use server';
 * import { authedAction } from '@/server/auth';
 *
 * export const approveQuotation = authedAction(
 *   async (user, id: string) => {           // user มาก่อนเสมอ
 *     // ... มี user ที่ผ่าน auth แล้วแน่นอน
 *   },
 *   'admin', 'account',                       // role ที่อนุญาต (เว้นว่าง = แค่ต้อง login)
 * );
 */
export function authedAction<TArgs extends unknown[], R>(
  handler: (user: SessionUser, ...args: TArgs) => Promise<R>,
  ...roles: Role[]
): (...args: TArgs) => Promise<R> {
  return async (...args: TArgs): Promise<R> => {
    const user = await requireUser(); // ไม่ login → redirect ไป LOGIN_URL (throw ภายใน)
    if (roles.length > 0) requireRole(user, ...roles); // ไม่มีสิทธิ์ → ForbiddenError
    return handler(user, ...args);
  };
}
