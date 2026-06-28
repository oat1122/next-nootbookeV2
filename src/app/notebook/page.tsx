import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { listNotebooks, getNotebookStats, listNotebookOwners } from '@/server/notebook/queries';
import {
  canManageAllNotebooks,
  canDelete,
  canAssignNotebookQueue,
  canReserveNotebookQueue,
  canCreateCustomerCare,
  canViewAllNotebookScope,
  canViewNotebookQueue,
  shouldCreateLeadIntoMine,
  shouldCreateLeadIntoQueue,
} from '@/server/notebook/permissions';
import type { IndexFilters } from '@/server/notebook/validation';
import type { EntryType, NotebookItem, NotebookPerms, Scope, ViewMode } from './_lib/types';
import { notebookHref } from './_lib/href';
import { ScopeTabs } from './_components/scope-tabs';
import { StatCards } from './_components/stat-cards';
import { NotebookToolbar } from './_components/notebook-toolbar';
import { UserFilter } from './_components/user-filter';
import { NotebookBoard } from './_components/notebook-board';
import { NotebookCreateBar } from './_components/notebook-create-bar';
import { NotebookUIProvider } from './_components/notebook-ui';

type SP = Record<string, string | string[] | undefined>;

const ENTRY_TYPES: EntryType[] = ['all', 'standard', 'customer_care', 'personal_activity'];

export default async function NotebookPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  // scope ตามสิทธิ์ (mine เสมอ; all/queue ตาม permission) — fallback mine
  const allowedScopes: Scope[] = [
    'mine',
    ...(canViewAllNotebookScope(user) ? (['all'] as Scope[]) : []),
    ...(canViewNotebookQueue(user) ? (['queue'] as Scope[]) : []),
  ];
  let scope = (str('scope') as Scope) ?? 'mine';
  if (!allowedScopes.includes(scope)) scope = 'mine';

  const entryRaw = str('entry_type');
  const entry_type: EntryType = ENTRY_TYPES.includes(entryRaw as EntryType)
    ? (entryRaw as EntryType)
    : 'all';
  const view: ViewMode = str('view') === 'card' ? 'card' : 'table';
  const status = str('status');
  const action = str('action');
  const search = str('search');
  const start_date = str('start_date');
  const end_date = str('end_date');
  const page = Math.max(1, Number(str('page')) || 1);
  // ตัวกรองผู้ดูแล (manage_by) ใช้ได้เฉพาะแท็บ all เท่านั้น
  const manage_by = scope === 'all' ? Number(str('manage_by')) || undefined : undefined;

  const filters: IndexFilters = {
    scope,
    entry_type,
    status: status ?? null,
    action: action ?? null,
    search: search ?? null,
    start_date: start_date ?? null,
    end_date: end_date ?? null,
    manage_by: manage_by ?? null,
    include: 'histories',
    paginate: true,
    per_page: 15,
  };

  const [list, statsEntries, owners] = await Promise.all([
    listNotebooks(filters, user, page),
    Promise.all(
      // manage_by กรองได้เฉพาะแท็บ all → ป้ายเลข mine/queue คงเป็นยอดรวมตามเดิม
      allowedScopes.map(
        async (s) =>
          [
            s,
            await getNotebookStats({ scope: s, entry_type, manage_by: s === 'all' ? manage_by : null }, user),
          ] as const,
      ),
    ),
    scope === 'all' ? listNotebookOwners(user) : Promise.resolve([]),
  ]);
  const statsByScope = Object.fromEntries(statsEntries) as Record<Scope, (typeof statsEntries)[number][1]>;
  const stats = statsByScope[scope];
  const scopeCounts: Partial<Record<Scope, number>> = {};
  for (const s of allowedScopes) scopeCounts[s] = statsByScope[s].total;

  const perms: NotebookPerms = {
    userId: user.userId,
    role: user.role,
    canManageAll: canManageAllNotebooks(user),
    canDelete: canDelete(user),
    canAssign: canAssignNotebookQueue(user),
    canReserve: canReserveNotebookQueue(user),
    canCreateStandard: true,
    canCreateLeadMine: shouldCreateLeadIntoMine(user, 'mine'),
    canCreateLeadQueue: shouldCreateLeadIntoQueue(user, 'queue'),
    canCreateCare: canCreateCustomerCare(user),
    canCreatePersonal: true,
  };

  // ค่าปัจจุบันสำหรับสร้าง href (คงพารามิเตอร์อื่นไว้)
  const current: Record<string, string | undefined> = {
    scope: scope === 'mine' ? undefined : scope,
    entry_type: entry_type === 'all' ? undefined : entry_type,
    status,
    action,
    search,
    start_date,
    end_date,
    manage_by: manage_by ? String(manage_by) : undefined,
    view: view === 'table' ? undefined : view,
  };

  const data = list.data as NotebookItem[];
  const total = list.paginated ? list.total : data.length;
  const lastPage = list.paginated ? list.lastPage : 1;

  const filterNote =
    scope === 'mine' ? 'ในความดูแลของคุณ' : scope === 'queue' ? 'รอรับจากคิวกลาง' : 'ทั้งหมดในระบบ';

  return (
    <NotebookUIProvider perms={perms} notebooks={data}>
      <main className="mx-auto w-full max-w-[1320px] px-7 pt-[26px] pb-20">
        {/* page header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[27px] font-bold tracking-tight">
              {scope === 'queue' ? 'คิวกลาง — รอรับลีด' : 'รายการที่ต้องติดตาม'}
            </h1>
            <p className="text-ink-2 mt-1.5 text-[14.5px]">
              {scope === 'queue'
                ? 'ลีดใหม่ที่ยังไม่มีเจ้าของ เลือกได้ทีละหลายรายการแล้วมอบหมายให้ทีมขายในคลิกเดียว'
                : 'จดทุกครั้งที่คุยกับลูกค้า แล้วระบบจะคอยเตือนว่าต้องติดตามใครต่อ — ไม่พลาดทุกดีล'}
            </p>
          </div>
          <NotebookCreateBar perms={perms} />
        </div>

        <ScopeTabs
          scope={scope}
          allowedScopes={allowedScopes}
          counts={scopeCounts}
          entryType={entry_type}
          current={current}
        />

        <StatCards stats={stats} scope={scope} />

        {scope === 'all' && owners.length > 0 && (
          <div className="mb-3.5">
            <UserFilter current={current} owners={owners} value={manage_by} />
          </div>
        )}

        <NotebookToolbar current={current} status={status} view={view} search={search ?? ''} />

        <div className="text-ink-3 mb-3 text-[13px]">
          พบ {total.toLocaleString('th-TH')} รายการ {filterNote}
        </div>

        <NotebookBoard notebooks={data} view={view} scope={scope} />

        {/* pagination */}
        {lastPage > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <PageLink current={current} page={page - 1} disabled={page <= 1} label="ก่อนหน้า" />
            <span className="text-ink-2 px-2 text-[13px]">
              หน้า {page} / {lastPage}
            </span>
            <PageLink current={current} page={page + 1} disabled={page >= lastPage} label="ถัดไป" />
          </div>
        )}
      </main>
    </NotebookUIProvider>
  );
}

function PageLink({
  current,
  page,
  disabled,
  label,
}: {
  current: Record<string, string | undefined>;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="border-border text-ink-4 cursor-not-allowed rounded-lg border bg-white px-3.5 py-2 text-[13px] font-medium">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={notebookHref(current, { page: page === 1 ? null : page })}
      className="border-border text-ink-2 hover:bg-surface-2 rounded-lg border bg-white px-3.5 py-2 text-[13px] font-medium"
    >
      {label}
    </Link>
  );
}
