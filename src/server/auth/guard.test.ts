import { beforeEach, describe, expect, it, vi } from 'vitest';

// server-only เป็น no-op ในชั้นทดสอบ
vi.mock('server-only', () => ({}));

// mock สองด่านที่ helper พึ่งพา — ไม่ต้องแตะ cookie/DB จริง
const requireUserMock = vi.fn();
const requireRoleMock = vi.fn();
vi.mock('./session', () => ({ requireUser: () => requireUserMock() }));
vi.mock('./rbac', () => ({ requireRole: (...args: unknown[]) => requireRoleMock(...args) }));

import { authedAction } from './guard';
import type { SessionUser } from './verify-token';

const USER = { userId: 1, role: 'sale' as const } as unknown as SessionUser;

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue(USER);
});

describe('authedAction', () => {
  it('เรียก requireUser ก่อน แล้วส่ง user เป็นอาร์กิวเมนต์แรกของ handler', async () => {
    const handler = vi.fn(
      async (user: SessionUser, a: string, b: number) => `${user.userId}:${a}:${b}`,
    );
    const result = await authedAction(handler)('x', 2);

    expect(requireUserMock).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(USER, 'x', 2);
    expect(result).toBe('1:x:2');
  });

  it('ไม่ระบุ role → ไม่เรียก requireRole', async () => {
    await authedAction(async () => 'ok')();
    expect(requireRoleMock).not.toHaveBeenCalled();
  });

  it('ระบุ role → เรียก requireRole ด้วย user + roles ที่ส่งมา', async () => {
    await authedAction(async () => 'ok', 'admin', 'account')();
    expect(requireRoleMock).toHaveBeenCalledWith(USER, 'admin', 'account');
  });

  it('requireRole โยน (ไม่มีสิทธิ์) → handler ไม่ถูกเรียก', async () => {
    requireRoleMock.mockImplementation(() => {
      throw new Error('forbidden');
    });
    const handler = vi.fn();
    await expect(authedAction(handler, 'admin')()).rejects.toThrow('forbidden');
    expect(handler).not.toHaveBeenCalled();
  });

  it('requireUser redirect (throw เพราะไม่ login) → handler ไม่ถูกเรียก', async () => {
    requireUserMock.mockRejectedValue(new Error('NEXT_REDIRECT'));
    const handler = vi.fn();
    await expect(authedAction(handler)()).rejects.toThrow('NEXT_REDIRECT');
    expect(handler).not.toHaveBeenCalled();
    expect(requireRoleMock).not.toHaveBeenCalled();
  });
});
