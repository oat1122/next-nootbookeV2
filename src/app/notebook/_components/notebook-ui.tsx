'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { convertNotebook, deleteNotebook, reserveNotebook } from '@/server/notebook/actions';
import { useNotebookAction } from '../_lib/run-action';
import type { NotebookItem, NotebookPerms } from '../_lib/types';
import { NotebookFormModal } from './notebook-form-modal';
import { NotebookDetailDrawer } from './notebook-detail-drawer';
import { DeleteConfirm } from './delete-confirm';
import { ConvertConfirm } from './convert-confirm';
import { LeadFormModal } from './lead-form-modal';
import { CustomerCareModal } from './customer-care-modal';
import { PersonalActivityModal } from './personal-activity-modal';
import { AssignDialog } from './assign-dialog';

export type CreateType = 'standard' | 'lead' | 'care' | 'personal';

type EditState = { mode: 'create' | 'edit'; item?: NotebookItem; presetAction?: string };

type Ctx = {
  perms: NotebookPerms;
  pending: boolean;
  selected: Set<number>;
  openCreate: (type: CreateType) => void;
  openEdit: (item: NotebookItem) => void;
  call: (item: NotebookItem) => void;
  openDetail: (id: number) => void;
  openDelete: (item: NotebookItem) => void;
  openAssign: (items: NotebookItem[], allowReserve?: boolean) => void;
  openAssignSelected: () => void;
  /** โอนลีดที่รับแล้วให้ฝ่ายขายอื่น (ปิดตัวเลือก "รับเอง") */
  transfer: (item: NotebookItem) => void;
  toggleSelect: (id: number) => void;
  selectAll: (ids: number[]) => void;
  clearSelection: () => void;
  convert: (item: NotebookItem) => void;
  reserve: (item: NotebookItem) => void;
};

const NotebookUIContext = createContext<Ctx | null>(null);

export function useNotebookUI(): Ctx {
  const ctx = useContext(NotebookUIContext);
  if (!ctx) throw new Error('useNotebookUI ต้องใช้ภายใน <NotebookUIProvider>');
  return ctx;
}

/**
 * ศูนย์กลาง state ของ overlay ทั้งหมด (modal/drawer/confirm) — mount ครั้งเดียว
 * ให้ create-bar (header) และ board (list) สั่งเปิดร่วมกันได้โดยไม่ต้อง prop-drill ข้าม island
 */
export function NotebookUIProvider({
  perms,
  notebooks,
  children,
}: {
  perms: NotebookPerms;
  notebooks: NotebookItem[];
  children: ReactNode;
}) {
  const { pending, run } = useNotebookAction();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [lead, setLead] = useState(false);
  const [care, setCare] = useState(false);
  const [personal, setPersonal] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [del, setDel] = useState<NotebookItem | null>(null);
  const [convertItem, setConvertItem] = useState<NotebookItem | null>(null);
  const [assignItems, setAssignItems] = useState<NotebookItem[] | null>(null);
  const [assignAllowReserve, setAssignAllowReserve] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const detail = detailId != null ? (notebooks.find((n) => n.id === detailId) ?? null) : null;

  // memo ค่า context ให้ identity นิ่ง — เปิด/ปิด overlay (edit/detail/del/assign/…)
  // ไม่แตะ field ใดใน ctx จึงไม่ทำให้ board ทั้งหน้า re-render ตอนเปิด dialog
  const ctx: Ctx = useMemo(
    () => ({
      perms,
      pending,
      selected,
      openCreate(type) {
        if (type === 'standard') setEdit({ mode: 'create' });
        else if (type === 'lead') setLead(true);
        else if (type === 'care') setCare(true);
        else setPersonal(true);
      },
      openEdit(item) {
        setDetailId(null);
        setEdit({ mode: 'edit', item });
      },
      // โทรหาลูกค้า = เปิดฟอร์มบันทึกการติดตามเดิม โดย preset ขั้นตอนถัดไป = โทร
      call(item) {
        setDetailId(null);
        setEdit({ mode: 'edit', item, presetAction: 'โทร' });
      },
      openDetail: (id) => setDetailId(id),
      openDelete: (item) => setDel(item),
      openAssign: (items, allowReserve = true) => {
        setAssignAllowReserve(allowReserve);
        setAssignItems(items);
      },
      openAssignSelected: () => {
        setAssignAllowReserve(true);
        setAssignItems(notebooks.filter((n) => selected.has(n.id)));
      },
      transfer: (item) => {
        setDetailId(null);
        setAssignAllowReserve(false);
        setAssignItems([item]);
      },
      toggleSelect: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      selectAll: (ids) => setSelected(new Set(ids)),
      clearSelection: () => setSelected(new Set()),
      convert: (item) => setConvertItem(item),
      reserve(item) {
        run(() => reserveNotebook(item.id), { success: 'รับลีดเข้าดูแลแล้ว' });
      },
    }),
    [perms, pending, selected, notebooks, run],
  );

  function doConvert() {
    if (!convertItem) return;
    const target = convertItem;
    run(() => convertNotebook(target.id), {
      success: `สร้าง “${target.nb_customer_name ?? ''}” เป็นลูกค้าแล้ว`,
      onDone: () => {
        setConvertItem(null);
        if (detailId === target.id) setDetailId(null);
      },
    });
  }

  function doDelete() {
    if (!del) return;
    const target = del;
    run(() => deleteNotebook(target.id), {
      success: 'ลบรายการแล้ว',
      onDone: () => {
        setDel(null);
        if (detailId === target.id) setDetailId(null);
      },
    });
  }

  return (
    <NotebookUIContext.Provider value={ctx}>
      {children}

      {edit && (
        <NotebookFormModal
          mode={edit.mode}
          item={edit.item}
          presetAction={edit.presetAction}
          onClose={() => setEdit(null)}
        />
      )}
      {lead && <LeadFormModal onClose={() => setLead(false)} />}
      {care && <CustomerCareModal onClose={() => setCare(false)} />}
      {personal && <PersonalActivityModal onClose={() => setPersonal(false)} />}

      {detail && (
        <NotebookDetailDrawer
          item={detail}
          perms={perms}
          onClose={() => setDetailId(null)}
          onEdit={() => ctx.openEdit(detail)}
          onConvert={() => ctx.convert(detail)}
          onReserve={() => ctx.reserve(detail)}
          onTransfer={() => ctx.transfer(detail)}
        />
      )}

      {del && (
        <DeleteConfirm
          name={del.nb_customer_name ?? ''}
          pending={pending}
          onClose={() => setDel(null)}
          onConfirm={doDelete}
        />
      )}

      {convertItem && (
        <ConvertConfirm
          item={convertItem}
          pending={pending}
          onClose={() => setConvertItem(null)}
          onConfirm={doConvert}
        />
      )}

      {assignItems && (
        <AssignDialog
          items={assignItems}
          allowReserve={assignAllowReserve}
          onClose={() => {
            setAssignItems(null);
            setSelected(new Set());
          }}
        />
      )}
    </NotebookUIContext.Provider>
  );
}
