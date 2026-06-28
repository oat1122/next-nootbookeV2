import { describe, expect, it } from 'vitest';
import type { notebookHistories, notebooks } from '@/server/db/schema';
import {
  buildHistoryReportSnapshots,
  deriveFreshQueue,
  diffAttributes,
  parseJson,
  toHistoryDTO,
  toNotebookDTO,
} from './mappers';

type HistoryRow = typeof notebookHistories.$inferSelect;
type NotebookRow = typeof notebooks.$inferSelect;

const hist = (over: Partial<HistoryRow>): HistoryRow =>
  ({
    id: 0,
    notebookId: 1,
    action: 'updated',
    oldValues: null,
    newValues: null,
    actionBy: null,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: null,
    ...over,
  }) as HistoryRow;

const row = (over: Partial<NotebookRow>): NotebookRow =>
  ({
    id: 1,
    nbDate: null,
    nbTime: null,
    nbCustomerName: 'A',
    nbIsOnline: false,
    nbAdditionalInfo: null,
    nbContactNumber: null,
    nbEmail: null,
    nbContactPerson: null,
    nbAction: null,
    nbStatus: null,
    nbRemarks: null,
    nbNextFollowupDate: null,
    nbNextFollowupNote: null,
    nbIsFavorite: false,
    nbIsFreshQueue: false,
    nbManageBy: null,
    nbWorkflow: 'standard',
    nbEntryType: 'standard',
    nbSourceType: null,
    nbSourceCustomerId: null,
    nbSourceNotebookId: null,
    nbLeadPayload: null,
    nbClaimedAt: null,
    nbConvertedAt: null,
    nbConvertedCustomerId: null,
    createdBy: 1,
    updatedBy: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }) as NotebookRow;

describe('parseJson (MariaDB longtext JSON)', () => {
  it('parse string/object/null ได้ถูกต้อง', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson({ a: 1 })).toEqual({ a: 1 });
    expect(parseJson(null)).toBeNull();
    expect(parseJson('null')).toBeNull();
    expect(parseJson('not json')).toBeNull();
  });
});

describe('deriveFreshQueue (port observer)', () => {
  const base = {
    nbConvertedAt: null,
    nbWorkflow: 'lead_queue',
    nbManageBy: 5,
    nbStatus: null,
    nbNextFollowupDate: null,
    nbNextFollowupNote: null,
  };
  it('lead_queue + assigned + ไม่มี status/followup → true', () => {
    expect(deriveFreshQueue(base)).toBe(true);
  });
  it('false เมื่อ converted / standard / ไม่มี owner / มี status', () => {
    expect(deriveFreshQueue({ ...base, nbConvertedAt: new Date() })).toBe(false);
    expect(deriveFreshQueue({ ...base, nbWorkflow: 'standard' })).toBe(false);
    expect(deriveFreshQueue({ ...base, nbManageBy: null })).toBe(false);
    expect(deriveFreshQueue({ ...base, nbStatus: 'called' })).toBe(false);
    expect(deriveFreshQueue({ ...base, nbNextFollowupNote: 'x' })).toBe(false);
  });
});

describe('toNotebookDTO nb_is_fresh_queue (derive on read — กัน stored flag เพี้ยน)', () => {
  it('derive=true แม้ stored flag=false (false negative ใน DB เช่น row #459)', () => {
    const dto = toNotebookDTO(row({ nbWorkflow: 'lead_queue', nbManageBy: 5, nbIsFreshQueue: false }));
    expect(dto.nb_is_fresh_queue).toBe(true);
  });
  it('derive=false แม้ stored flag=true (false positive ใน DB)', () => {
    const dto = toNotebookDTO(
      row({ nbWorkflow: 'lead_queue', nbManageBy: 5, nbStatus: 'called', nbIsFreshQueue: true }),
    );
    expect(dto.nb_is_fresh_queue).toBe(false);
  });
});

describe('diffAttributes (port getChanges)', () => {
  it('คืนเฉพาะคีย์ที่เปลี่ยน ยกเว้น updated_at', () => {
    const before = row({ nbStatus: null, nbManageBy: null });
    const after = row({ nbStatus: 'called', nbManageBy: 7, updatedAt: new Date('2026-02-02T00:00:00Z') });
    const { old, new: nw } = diffAttributes(before, after);
    expect(nw).toEqual({ nb_status: 'called', nb_manage_by: 7 });
    expect(old).toEqual({ nb_status: null, nb_manage_by: null });
  });
});

describe('buildHistoryReportSnapshots (timeline)', () => {
  it('ไล่ state created → updated → reserved สะสมถูกต้อง', () => {
    const histories = [
      hist({ id: 1, action: 'created', oldValues: null, newValues: { a: 1, b: 2 }, createdAt: new Date('2026-01-01T00:00:00Z') }),
      hist({ id: 2, action: 'updated', oldValues: { a: 1 }, newValues: { a: 5 }, createdAt: new Date('2026-01-02T00:00:00Z') }),
      hist({ id: 3, action: 'reserved', oldValues: {}, newValues: { nb_manage_by: 10 }, createdAt: new Date('2026-01-03T00:00:00Z') }),
    ];
    const snap = buildHistoryReportSnapshots(histories);
    expect(snap.get('history-1')).toEqual({ old: null, new: { a: 1, b: 2 } });
    expect(snap.get('history-2')).toEqual({ old: { a: 1, b: 2 }, new: { a: 5, b: 2 } });
    expect(snap.get('history-3')).toEqual({
      old: { a: 5, b: 2 },
      new: { a: 5, b: 2, nb_manage_by: 10 },
    });
  });
});

describe('toHistoryDTO display name', () => {
  it('แทน nb_manage_by id ด้วยชื่อ user ใน display_*', () => {
    const h = hist({ id: 9, action: 'reserved', newValues: { nb_manage_by: 10 } });
    const dto = toHistoryDTO(
      { history: h, actionBy: null },
      { old: null, new: { nb_manage_by: 10 } },
      new Map([[10, 'Alice']]),
    );
    expect(dto.new_values).toEqual({ nb_manage_by: 10 });
    expect(dto.display_new_values).toEqual({ nb_manage_by: 'Alice' });
    expect(dto.display_report_new_values).toEqual({ nb_manage_by: 'Alice' });
  });
});
