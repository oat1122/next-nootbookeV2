import Link from 'next/link';
import { cn } from '@/lib/utils';
import { notebookHref } from '../_lib/href';
import { SCOPE_LABEL, ENTRY_LABEL, type EntryType, type Scope } from '../_lib/types';

const ENTRY_TYPES: EntryType[] = ['all', 'standard', 'customer_care', 'personal_activity'];

/** scope pills (ลูกค้าของฉัน/ทั้งหมด/คิวกลาง) + ตัวกรองชนิด entry — server, ขับด้วย URL */
export function ScopeTabs({
  scope,
  allowedScopes,
  counts,
  entryType,
  current,
}: {
  scope: Scope;
  allowedScopes: Scope[];
  counts: Partial<Record<Scope, number>>;
  entryType: EntryType;
  current: Record<string, string | undefined>;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="inline-flex gap-1 rounded-[13px] p-1" style={{ background: '#F0EBE3' }}>
        {allowedScopes.map((s) => {
          const on = scope === s;
          return (
            <Link
              key={s}
              href={notebookHref(current, { scope: s === 'mine' ? null : s, status: null, page: null })}
              className={cn(
                'inline-flex items-center gap-2 rounded-[10px] px-[18px] py-[9px] text-[14.5px] font-semibold whitespace-nowrap transition-all',
                on ? 'bg-white text-foreground shadow-sm' : 'text-ink-3 hover:text-foreground',
              )}
            >
              {SCOPE_LABEL[s]}
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold"
                style={
                  on
                    ? { background: '#E1543B', color: '#fff' }
                    : { background: '#E2DCD3', color: '#857E74' }
                }
              >
                {counts[s] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {/* entry-type filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ENTRY_TYPES.map((e) => {
          const on = entryType === e;
          return (
            <Link
              key={e}
              href={notebookHref(current, { entry_type: e === 'all' ? null : e, page: null })}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-ink-2 bg-white hover:bg-surface-2',
              )}
            >
              {ENTRY_LABEL[e]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
