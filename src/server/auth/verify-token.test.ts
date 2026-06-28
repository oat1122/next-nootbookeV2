import { beforeEach, describe, expect, it, vi } from 'vitest';

// server-only เป็น no-op ในชั้นทดสอบ
vi.mock('server-only', () => ({}));
// คุมค่า env ให้แน่นอน + เลี่ยง createEnv validation ตอนเทสต์
// (ตั้ง SANCTUM_MAX_TOKEN_AGE_DAYS=30 เพื่อทดสอบ F3, SANCTUM_REQUIRED_ABILITY='*' สำหรับ F4)
vi.mock('@/lib/env', () => ({
  env: {
    SANCTUM_TOKENABLE_TYPE: 'App\\Models\\User',
    SANCTUM_REQUIRED_ABILITY: '*',
    SANCTUM_MAX_TOKEN_AGE_DAYS: 30,
  },
}));
// mock DB client — ไม่ต่อ MariaDB จริง
vi.mock('@/server/db/client', () => ({
  db: {
    query: {
      personalAccessTokens: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    // loadSubRoleCodes(): select(...).from(...).innerJoin(...).where(...) → default ไม่มี sub-role
    select: vi.fn(() => ({
      from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }),
    })),
  },
}));

import { db } from '@/server/db/client';
import type { personalAccessTokens, users } from '@/server/db/schema';
import { extractPlainToken, hashToken, loadSessionUser, verifySanctumToken } from './verify-token';

const tokenFindFirst = vi.mocked(db.query.personalAccessTokens.findFirst);
const userFindFirst = vi.mocked(db.query.users.findFirst);

const PLAIN = 'plain-secret';
const RAW = `1|${PLAIN}`;
// sha256('plain-secret') ที่รู้ค่าล่วงหน้า
const KNOWN_HASH = 'cc0e7608b73ea73b08fd28b582c21ba4ce5a0b1c9202bf7d2dcc85366205b622';

// แถว mock ต้องครบทุกคอลัมน์ตาม schema จริง เพราะ `db.query.*.findFirst` (เวอร์ชันไม่ส่ง
// columns projection) ถูก type ให้คืน row เต็ม → mockResolvedValue บังคับ shape เต็ม
type TokenRow = typeof personalAccessTokens.$inferSelect;
type UserRow = typeof users.$inferSelect;

function tokenRow(overrides: Partial<TokenRow> = {}): TokenRow {
  return {
    id: 1,
    tokenableType: 'App\\Models\\User',
    tokenableId: 1,
    name: 'api-token',
    token: KNOWN_HASH,
    abilities: '["*"]',
    lastUsedAt: null,
    expiresAt: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    userId: 1,
    userUuid: 'u-1',
    username: 'somchai',
    password: 'hashed-pass',
    role: 'sale',
    userEmpNo: null,
    userFirstname: 'สมชาย',
    userLastname: 'ใจดี',
    userPhone: null,
    userNickname: 'ชาย',
    userPosition: 'พนักงานขาย',
    enable: 'Y',
    userIsEnable: true,
    deleted: 0,
    userIsDeleted: false,
    createdAt: null,
    updatedAt: null,
    newPass: null,
    passIsUpdated: false,
    userCreatedDate: null,
    userCreatedBy: null,
    userUpdatedDate: null,
    userUpdatedBy: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // F9 audit log ใช้ console.warn — ปิดเสียงไม่ให้รก output เทสต์ (ไม่ assert)
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('hashToken', () => {
  it('คำนวณ sha256 ตรงค่าที่รู้ล่วงหน้า', () => {
    expect(hashToken(PLAIN)).toBe(KNOWN_HASH);
  });
});

describe('verifySanctumToken', () => {
  it('token ถูกต้อง → คืน SessionUser (ไม่มี password หลุดออกมา)', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow());
    userFindFirst.mockResolvedValue(userRow());

    const user = await verifySanctumToken(RAW);

    expect(user).toEqual({
      userId: 1,
      userUuid: 'u-1',
      username: 'somchai',
      role: 'sale',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      nickname: 'ชาย',
      position: 'พนักงานขาย',
      subRoleCodes: [],
    });
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('newPass');
  });

  it('ไม่มี "|" และหา hash ไม่เจอ → null (ไม่ throw)', async () => {
    tokenFindFirst.mockResolvedValue(undefined);
    expect(await verifySanctumToken('no-pipe-token')).toBeNull();
  });

  it('plain ว่าง ("id|") → null โดยไม่แตะ DB', async () => {
    expect(await verifySanctumToken('1|')).toBeNull();
    expect(tokenFindFirst).not.toHaveBeenCalled();
  });

  it('หา hash ไม่เจอ → null', async () => {
    tokenFindFirst.mockResolvedValue(undefined);
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  it('token หมดอายุ → null', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow({ expiresAt: new Date(Date.now() - 1000) }));
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  it('tokenableType ผิด → null', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow({ tokenableType: 'App\\Models\\Other' }));
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  it('userIsEnable = false → null', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow());
    userFindFirst.mockResolvedValue(userRow({ userIsEnable: false }));
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  it('userIsDeleted = true → null', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow());
    userFindFirst.mockResolvedValue(userRow({ userIsDeleted: true }));
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  it('หา user ไม่เจอ → null', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow());
    userFindFirst.mockResolvedValue(undefined);
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  // F8: plain เอา "ทุกอย่างหลัง '|' ตัวแรก" — รองรับ plain ที่มี '|' ในตัว
  it('F8: token ที่มี "|" หลายตัว → ใช้ทุกอย่างหลัง "|" ตัวแรกเป็น plain', async () => {
    const plainWithPipe = 'aa|bb'; // plain จริงมี '|' อยู่ด้วย
    tokenFindFirst.mockResolvedValue(tokenRow({ token: hashToken(plainWithPipe) }));
    userFindFirst.mockResolvedValue(userRow());

    // raw = "5|aa|bb" → plain ต้องเป็น "aa|bb" (ไม่ใช่ "aa")
    const user = await verifySanctumToken(`5|${plainWithPipe}`);
    expect(user).not.toBeNull();
    expect(tokenFindFirst).toHaveBeenCalledOnce();
  });

  // F4: เคารพ Sanctum abilities (scope)
  it('F4: abilities ไม่มี "*" → null (fail-closed)', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow({ abilities: '["accounting:read"]' }));
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  it('F4: abilities เป็น null → null', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow({ abilities: null }));
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  it('F4: abilities เป็น JSON เสีย → null (ไม่ throw)', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow({ abilities: 'not-json' }));
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  // F3: policy อายุสูงสุด (mock ตั้ง SANCTUM_MAX_TOKEN_AGE_DAYS=30)
  it('F3: token createdAt เก่ากว่า max-age → null', async () => {
    const old = new Date(Date.now() - 40 * 86_400_000); // 40 วันที่แล้ว
    tokenFindFirst.mockResolvedValue(tokenRow({ createdAt: old }));
    expect(await verifySanctumToken(RAW)).toBeNull();
  });

  it('F3: token createdAt ยังไม่เกิน max-age → ผ่าน', async () => {
    const recent = new Date(Date.now() - 5 * 86_400_000); // 5 วันที่แล้ว
    tokenFindFirst.mockResolvedValue(tokenRow({ createdAt: recent }));
    userFindFirst.mockResolvedValue(userRow());
    expect(await verifySanctumToken(RAW)).not.toBeNull();
  });
});

// ── การเชื่อม cookie ข้าม subdomain (legacy tnp → v2) — docesacc/audit/03 ───────────────
// legacy `setSharedAuthCookie()` เขียน document.cookie = encodeURIComponent("{id}|{plain}")
// → '|' กลายเป็น '%7C'. ฝั่ง v2 `cookies().get(...).value` ถูก Next ถอด decodeURIComponent ให้
// อัตโนมัติ (next/dist/compiled/@edge-runtime/cookies → parseCookie). เทสต์ชุดนี้ "ล็อก wire-format"
// ของการเชื่อมข้าม subdomain ไว้ — กันคนแก้ extractPlainToken/สมมติฐาน decode แล้ว handoff พังเงียบ
// ตอน deploy. ดู audit/03 §H1
describe('cross-subdomain cookie round-trip (legacy encode → Next decode)', () => {
  const ENCODED = encodeURIComponent(RAW); // = "1%7Cplain-secret" เหมือนที่ legacy ตั้ง cookie จริง

  it("legacy encodeURIComponent ทำให้ '|' เป็น '%7C' จริง (ยืนยันความเสี่ยงที่ต้องถอด)", () => {
    expect(ENCODED).toBe('1%7Cplain-secret');
    expect(ENCODED).not.toContain('|');
  });

  it('encode → decodeURIComponent (เหมือน Next parseCookie) → verifySanctumToken ผ่าน', async () => {
    tokenFindFirst.mockResolvedValue(tokenRow());
    userFindFirst.mockResolvedValue(userRow());
    // Next ถอดค่าก่อนถึง getCurrentUser → ค่าที่ verify ได้รับคือค่าที่ถอดแล้ว ต้องเท่ากับ RAW เดิม
    const decoded = decodeURIComponent(ENCODED);
    expect(decoded).toBe(RAW);
    expect(await verifySanctumToken(decoded)).not.toBeNull();
  });

  it("ถ้า '%7C' ไม่ถูกถอด → plain/hash ผิด (อธิบายว่าทำไม decode ของ Next ขาดไม่ได้)", () => {
    // ไม่มี '|' literal ใน "1%7Cplain-secret" → extractPlainToken คืนทั้งสตริง → hash คนละค่ากับ DB
    expect(extractPlainToken(ENCODED)).toBe(ENCODED);
    expect(hashToken(extractPlainToken(ENCODED)!)).not.toBe(KNOWN_HASH);
    // ตรงข้าม: ค่าที่ถอดแล้ว (RAW) ให้ plain ถูก → hash ตรงกับที่ Sanctum เก็บใน DB
    expect(hashToken(extractPlainToken(RAW)!)).toBe(KNOWN_HASH);
  });
});

describe('loadSessionUser', () => {
  it('คืน null เมื่อ user ถูกปิดใช้งาน', async () => {
    userFindFirst.mockResolvedValue(userRow({ userIsEnable: false }));
    expect(await loadSessionUser(1)).toBeNull();
  });

  it('map ฟิลด์ที่ว่างเป็น null', async () => {
    userFindFirst.mockResolvedValue(
      userRow({ userFirstname: null, userLastname: null, userNickname: null, userPosition: null }),
    );
    const user = await loadSessionUser(1);
    expect(user).toMatchObject({ firstName: null, lastName: null, nickname: null, position: null });
  });
});
