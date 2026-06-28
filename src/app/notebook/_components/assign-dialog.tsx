'use client';

import { useEffect, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { assignNotebook, listAssignableSalesUsers } from '@/server/notebook/actions';
import { useNotebookAction } from '../_lib/run-action';
import type { NotebookItem } from '../_lib/types';

type SalesUser = { user_id: number; name: string };

/** มอบหมาย notebook (queue) ให้ฝ่ายขาย — โหลดรายชื่อจาก listAssignableSalesUsers */
export function AssignDialog({ item, onClose }: { item: NotebookItem; onClose: () => void }) {
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
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

  function assign() {
    if (!sel) return;
    run(() => assignNotebook(item.id, sel), { success: 'มอบหมายงานแล้ว', onDone: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="border-border flex items-center gap-3 border-b bg-white px-5 py-4">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <Users className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold">มอบหมายให้ฝ่ายขาย</div>
            <div className="text-ink-3 truncate text-[13px]">{item.nb_customer_name || '—'}</div>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {loading ? (
            <div className="text-ink-4 px-3 py-8 text-center text-[13px]">กำลังโหลดรายชื่อ...</div>
          ) : users.length === 0 ? (
            <div className="text-ink-4 px-3 py-8 text-center text-[13px]">ไม่พบฝ่ายขายที่รับงานได้</div>
          ) : (
            users.map((u) => {
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
            onClick={assign}
            disabled={pending || !sel}
            className={cn(
              'bg-primary text-primary-foreground rounded-xl px-6 py-2.5 text-[14px] font-semibold transition hover:brightness-95',
              (pending || !sel) && 'opacity-50',
            )}
          >
            มอบหมาย
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
