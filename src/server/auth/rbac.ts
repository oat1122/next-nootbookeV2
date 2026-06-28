import 'server-only';
import type { SessionUser } from './verify-token';

/** role ของ user (อ้างจาก SessionUser → enum `users.role`) */
export type Role = SessionUser['role'];

/** โยนเมื่อ user ไม่มีสิทธิ์ — ใช้ดักใน Server Action (ดู docesacc/04 §5) */
export class ForbiddenError extends Error {
  constructor(message = 'ไม่มีสิทธิ์ดำเนินการนี้') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** true ถ้า role ของ user อยู่ในรายการที่อนุญาต */
export function hasRole(user: Pick<SessionUser, 'role'>, ...roles: Role[]): boolean {
  return roles.includes(user.role);
}

/** true ถ้าเป็น admin */
export function isAdmin(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'admin';
}

/**
 * บังคับสิทธิ์ใน Server Action — ไม่ผ่าน → โยน ForbiddenError
 * (หน้า page ให้ใช้ hasRole ตัดสินใจ render/redirect เอง)
 */
export function requireRole(user: Pick<SessionUser, 'role'>, ...roles: Role[]): void {
  if (!hasRole(user, ...roles)) {
    throw new ForbiddenError();
  }
}
