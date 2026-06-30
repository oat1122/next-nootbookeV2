'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Users, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  assignNotebook,
  assignNotebooks,
  listAssignableSalesUsers,
  reserveNotebook,
} from '@/server/notebook/actions';
import { avatarStyle, initials } from '../_lib/notebook-display';
import { useNotebookAction } from '../_lib/run-action';
import { useNotebookUI } from './notebook-ui';
import type { NotebookItem } from '../_lib/types';

type SalesUser = { user_id: number; name: string; load: number };
type Selection = 'self' | number;

const ACCENT = '#e1543b';

/** วงกลม check ด้านขวาของการ์ดผู้รับ */
function checkStyle(on: boolean, size: number): React.CSSProperties {
  return {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    borderRadius: 999,
    border: on ? 'none' : '1.5px solid #ddd6cc',
    background: on ? ACCENT : '#fff',
  };
}

/** การ์ดผู้รับ (self/sales) — กรอบแดงเมื่อเลือก */
function cardStyle(on: boolean): React.CSSProperties {
  return {
    border: on ? `2px solid ${ACCENT}` : '1px solid #ece7df',
    borderRadius: 14,
    padding: on ? '11px 12px' : '12px 13px',
    background: on ? '#fdf2ef' : '#fff',
    transition: 'all .12s',
  };
}

/**
 * มอบหมาย lead จากคิว — เลือก "รับเอง (ตัวฉัน)" หรือมอบให้ฝ่ายขายคนอื่น
 * รองรับหลายรายการพร้อมกัน (bulk) — รายชื่อ + ภาระงานจาก listAssignableSalesUsers
 */
export function AssignDialog({
  items,
  allowReserve = true,
  onClose,
}: {
  items: NotebookItem[];
  /** false = โหมดโอนต่อ (ลีดที่รับแล้ว) — ซ่อนตัวเลือก "รับเอง" */
  allowReserve?: boolean;
  onClose: () => void;
}) {
  const { perms } = useNotebookUI();
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Selection | null>(null);
  const { pending, run } = useNotebookAction();

  useEffect(() => {
    let alive = true;
    listAssignableSalesUsers()
      .then((u) => alive && (setUsers(u), setLoading(false)))
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // "คนอื่น" = ตัดตัวเองออก (ตัวเองอยู่ในตัวเลือก "รับเอง" ด้านบนผ่าน reserve)
  const others = useMemo(
    () => users.filter((u) => u.user_id !== perms.userId),
    [users, perms.userId],
  );

  function submit() {
    if (sel == null) return;
    const ids = items.map((i) => i.id);
    if (sel === 'self') {
      // ponytail: loop reserveNotebook (atomic claim ต่อแถว) แทนเพิ่ม bulk-reserve action ใหม่
      run(
        async () => {
          for (const id of ids) await reserveNotebook(id);
        },
        { success: 'รับลีดเข้าดูแลแล้ว', onDone: onClose },
      );
    } else if (ids.length === 1) {
      run(() => assignNotebook(ids[0], sel), { success: 'มอบหมายงานแล้ว', onDone: onClose });
    } else {
      run(() => assignNotebooks({ notebook_ids: ids, sales_user_id: sel }), {
        success: `มอบหมาย ${ids.length} รายการแล้ว`,
        onDone: onClose,
      });
    }
  }

  const n = items.length;
  const subtitle = n === 1 ? items[0].nb_customer_name || '—' : `เลือก ${n} รายการ`;
  const stack = items.slice(0, 4);
  const more = n - stack.length;
  const ready = sel != null;
  const confirmLabel = !ready
    ? 'เลือกผู้รับผิดชอบ'
    : sel === 'self'
      ? `รับเข้าดูแล ${n} รายการ`
      : `มอบหมาย ${n} รายการ`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[480px]"
      >
        {/* header */}
        <div className="border-border flex items-center gap-3 border-b px-5 py-4">
          <div
            className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px]"
            style={{ background: '#fceeea', color: ACCENT }}
          >
            <Users className="size-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16.5px] font-bold">มอบหมายลีด</div>
            <div className="mt-0.5 flex items-center gap-2">
              <div className="flex">
                {stack.map((it, i) => (
                  <div
                    key={it.id}
                    style={{
                      ...avatarStyle(it.nb_customer_name, 26),
                      marginLeft: i === 0 ? 0 : -8,
                      border: '2px solid #fff',
                    }}
                  >
                    {initials(it.nb_customer_name)}
                  </div>
                ))}
                {more > 0 && (
                  <div
                    className="flex items-center justify-center text-[11px] font-bold"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: '#f0ebe3',
                      color: '#857e74',
                      marginLeft: -8,
                      border: '2px solid #fff',
                    }}
                  >
                    +{more}
                  </div>
                )}
              </div>
              <span className="text-ink-3 truncate text-[13px]">{subtitle}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-[#857e74]"
            style={{ background: '#f4f0ea' }}
            aria-label="ปิด"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* body */}
        <div className="max-h-[60vh] overflow-y-auto px-[18px] py-4">
          {allowReserve && perms.canReserve && (
            <>
              <div className="text-ink-4 mb-2 px-0.5 text-[12px] font-semibold">รับเข้าดูแลเอง</div>
              <button
                type="button"
                onClick={() => setSel('self')}
                className="flex w-full items-center justify-between"
                style={cardStyle(sel === 'self')}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold"
                    style={{ background: '#fceeea', color: ACCENT }}
                  >
                    ฉัน
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-[14.5px] font-semibold">รับเอง (ตัวฉัน)</span>
                    <span className="text-ink-3 mt-px block text-[12.5px]">รับลีดเข้าดูแลทันที</span>
                  </span>
                </span>
                <span style={checkStyle(sel === 'self', 22)}>
                  {sel === 'self' && <Check className="size-3.5 text-white" strokeWidth={3} />}
                </span>
              </button>
            </>
          )}

          <div className="my-[18px] flex items-center gap-2.5 px-0.5">
            <div className="h-px flex-1" style={{ background: '#f0ebe3' }} />
            <span className="text-ink-4 text-[12px] font-semibold">หรือมอบให้ทีมขาย</span>
            <div className="h-px flex-1" style={{ background: '#f0ebe3' }} />
          </div>

          {loading ? (
            <div className="text-ink-4 py-8 text-center text-[13px]">กำลังโหลดรายชื่อ...</div>
          ) : others.length === 0 ? (
            <div className="text-ink-4 py-8 text-center text-[13px]">ไม่พบฝ่ายขายที่รับงานได้</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {others.map((u) => {
                const on = sel === u.user_id;
                const free = u.load === 0;
                return (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => setSel(u.user_id)}
                    className="flex items-center gap-2.5"
                    style={cardStyle(on)}
                  >
                    <span style={avatarStyle(u.name, 38)}>{initials(u.name)}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[14px] font-semibold">{u.name}</span>
                      <span
                        className="mt-px block text-[12px]"
                        style={{ color: free ? '#1B7A45' : '#a8a29a', fontWeight: free ? 600 : 400 }}
                      >
                        {free ? 'ว่างอยู่ รับงานได้' : `ดูแล ${u.load} ลีด`}
                      </span>
                    </span>
                    <span style={checkStyle(on, 20)}>
                      {on && <Check className="size-[13px] text-white" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div
          className="border-border flex items-center justify-between gap-3 border-t px-[18px] py-3.5"
          style={{ background: '#fffdfb' }}
        >
          <span className="text-ink-4 text-[12.5px]">{ready ? '' : 'เลือกผู้รับผิดชอบ 1 คน'}</span>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="border-border text-ink-2 hover:bg-surface-2 rounded-xl border bg-white px-[18px] py-2.5 text-[14px] font-semibold"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !ready}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold transition"
              style={{
                background: ready ? ACCENT : '#f0d9d2',
                color: ready ? '#fff' : '#c9a99f',
                cursor: ready ? 'pointer' : 'not-allowed',
                boxShadow: ready ? '0 2px 8px rgba(225,84,59,.3)' : 'none',
                opacity: pending ? 0.6 : 1,
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
