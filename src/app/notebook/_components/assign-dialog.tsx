'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, UserCheck, Users } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  assignNotebook,
  assignNotebooks,
  listAssignableSalesUsers,
  reserveNotebook,
} from '@/server/notebook/actions';
import { useNotebookAction } from '../_lib/run-action';
import { useNotebookUI } from './notebook-ui';
import type { NotebookItem } from '../_lib/types';

type SalesUser = { user_id: number; name: string };
type Selection = 'self' | number;

/**
 * มอบหมาย lead จากคิว — เลือก "รับเอง (ตัวฉัน)" หรือมอบให้ฝ่ายขายคนอื่น
 * รองรับหลายรายการพร้อมกัน (bulk) — รายชื่อจาก listAssignableSalesUsers
 */
export function AssignDialog({ items, onClose }: { items: NotebookItem[]; onClose: () => void }) {
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

  const subtitle = items.length === 1 ? items[0].nb_customer_name || '—' : `เลือก ${items.length} รายการ`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="border-border flex items-center gap-3 border-b bg-white px-5 py-4">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <Users className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold">มอบหมายลีด</div>
            <div className="text-ink-3 truncate text-[13px]">{subtitle}</div>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {perms.canReserve && (
            <>
              <button
                type="button"
                onClick={() => setSel('self')}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors',
                  sel === 'self' ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2/60',
                )}
              >
                <span className="flex items-center gap-2">
                  <UserCheck className="text-primary size-4" />
                  รับเอง (ตัวฉัน)
                </span>
                {sel === 'self' && <Check className="text-primary size-4" />}
              </button>
              <div className="text-ink-4 px-3 pt-2.5 pb-1 text-[12px] font-medium">มอบให้คนอื่น</div>
            </>
          )}

          {loading ? (
            <div className="text-ink-4 px-3 py-8 text-center text-[13px]">กำลังโหลดรายชื่อ...</div>
          ) : others.length === 0 ? (
            <div className="text-ink-4 px-3 py-8 text-center text-[13px]">ไม่พบฝ่ายขายที่รับงานได้</div>
          ) : (
            others.map((u) => {
              const on = sel === u.user_id;
              return (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => setSel(u.user_id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors',
                    on ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2/60',
                  )}
                >
                  {u.name}
                  {on && <Check className="text-primary size-4" />}
                </button>
              );
            })
          )}
        </div>

        <div className="border-border flex justify-end gap-2.5 border-t bg-white/95 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="border-border text-ink-2 hover:bg-surface-2 rounded-xl border bg-white px-5 py-2.5 text-[14px] font-medium"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || sel == null}
            className={cn(
              'bg-primary text-primary-foreground rounded-xl px-6 py-2.5 text-[14px] font-semibold transition hover:brightness-95',
              (pending || sel == null) && 'opacity-50',
            )}
          >
            ยืนยัน
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
