import { describe, expect, it, vi } from 'vitest';

// server-only เป็น no-op ในชั้นทดสอบ
vi.mock('server-only', () => ({}));

import { ForbiddenError, hasRole, isAdmin, requireRole } from './rbac';

const admin = { role: 'admin' as const };
const sale = { role: 'sale' as const };

describe('hasRole', () => {
  it('true เมื่อ role อยู่ในรายการที่อนุญาต', () => {
    expect(hasRole(sale, 'admin', 'manager', 'sale')).toBe(true);
  });
  it('false เมื่อ role ไม่อยู่ในรายการ', () => {
    expect(hasRole(sale, 'admin', 'manager')).toBe(false);
  });
  it('false เมื่อไม่ส่ง role ใด ๆ มาเทียบ', () => {
    expect(hasRole(admin)).toBe(false);
  });
});

describe('isAdmin', () => {
  it('true เฉพาะ admin', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(sale)).toBe(false);
  });
});

describe('requireRole', () => {
  it('ผ่านเงียบ ๆ เมื่อมีสิทธิ์', () => {
    expect(() => requireRole(admin, 'admin')).not.toThrow();
  });
  it('โยน ForbiddenError เมื่อไม่มีสิทธิ์', () => {
    expect(() => requireRole(sale, 'admin', 'manager')).toThrow(ForbiddenError);
  });
});
