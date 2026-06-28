import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireUser, ForbiddenError } from '@/server/auth';
import { getNotebookKpiSummary, getNotebookKpiDetails } from '@/server/notebook/kpi';
import { cn } from '@/lib/utils';
import type { KpiSummaryParams } from '@/server/notebook/validation';

type SP = Record<string, string | string[] | undefined>;

const PERIODS = [
  { v: 'today', label: 'วันนี้' },
  { v: 'week', label: 'สัปดาห์นี้' },
  { v: 'month', label: 'เดือนนี้' },
  { v: 'quarter', label: 'ไตรมาสนี้' },
  { v: 'year', label: 'ปีนี้' },
  { v: 'prev_month', label: 'เดือนก่อน' },
] as const;

export default async function NotebookReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const periodRaw = typeof sp.period === 'string' ? sp.period : 'month';
  const period = (PERIODS.some((p) => p.v === periodRaw) ? periodRaw : 'month') as KpiSummaryParams['period'];

  let denied = false;
  let summary: Awaited<ReturnType<typeof getNotebookKpiSummary>> | null = null;
  let details: Awaited<ReturnType<typeof getNotebookKpiDetails>> | null = null;
  try {
    [summary, details] = await Promise.all([
      getNotebookKpiSummary({ period }, user),
      getNotebookKpiDetails({ period }, user),
    ]);
  } catch (e) {
    if (e instanceof ForbiddenError) denied = true;
    else throw e;
  }

  const periodLabel = summary?.meta.period.label ?? '';
  const rows = summary?.data ?? [];
  const totalAdded = rows.reduce((s, r) => s + r.added_count, 0);
  const totalUpdated = rows.reduce((s, r) => s + r.updated_count, 0);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-7 pt-[26px] pb-20">
      <Link href="/notebook" className="text-ink-2 hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-[14px]">
        <ArrowLeft className="size-4" /> กลับไปสมุดจด
      </Link>

      <div className="mb-5">
        <h1 className="text-[27px] font-bold tracking-tight">รายงานสรุป KPI</h1>
        <p className="text-ink-2 mt-1.5 text-[14.5px]">สรุปกิจกรรมการจด/อัปเดต notebook {periodLabel && `· ${periodLabel}`}</p>
      </div>

      {/* period tabs */}
      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-[13px] p-1" style={{ background: '#F0EBE3' }}>
        {PERIODS.map((p) => {
          const on = period === p.v;
          return (
            <Link
              key={p.v}
              href={`/notebook/report?period=${p.v}`}
              className={cn(
                'rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-all',
                on ? 'text-foreground bg-white shadow-sm' : 'text-ink-3 hover:text-foreground',
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {denied ? (
        <div className="border-border text-ink-2 rounded-2xl border bg-white px-6 py-16 text-center">
          คุณไม่มีสิทธิ์ดูรายงานนี้
        </div>
      ) : (
        <>
          {/* summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            <SummaryCard value={totalAdded} label="จดใหม่" tone="#1B7A45" bg="#DCF3E3" />
            <SummaryCard value={totalUpdated} label="อัปเดต/ติดตาม" tone="#5E45A8" bg="#EDE7F6" />
            <SummaryCard value={totalAdded + totalUpdated} label="รวมกิจกรรม" tone="#9A6A00" bg="#FCEFD2" />
            <SummaryCard value={rows.length} label="ผู้ทำงาน" tone="#2C5FA8" bg="#E7EEF9" />
          </div>

          {/* per-user table */}
          <SectionTitle>สรุปต่อผู้ใช้</SectionTitle>
          <div className="border-border mb-8 overflow-hidden rounded-2xl border bg-white">
            <div className="text-ink-3 border-border grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b bg-[#FBF8F3] px-5 py-3 text-[12.5px] font-semibold">
              <div>ผู้ใช้</div>
              <div className="text-right">จดใหม่</div>
              <div className="text-right">อัปเดต</div>
              <div className="text-right">รวม</div>
            </div>
            {rows.length === 0 ? (
              <div className="text-ink-4 px-5 py-10 text-center text-[14px]">ไม่มีข้อมูลในช่วงนี้</div>
            ) : (
              rows.map((r) => (
                <div key={r.user_id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b px-5 py-3 text-[14px] last:border-0" style={{ borderColor: '#F2EDE5' }}>
                  <div className="font-medium">{r.user_name}</div>
                  <div className="num text-right">{r.added_count}</div>
                  <div className="num text-right">{r.updated_count}</div>
                  <div className="num text-right font-semibold">{r.added_count + r.updated_count}</div>
                </div>
              ))
            )}
          </div>

          {/* details */}
          <SectionTitle>กิจกรรมล่าสุด</SectionTitle>
          <div className="border-border overflow-hidden rounded-2xl border bg-white">
            <div className="text-ink-3 border-border grid grid-cols-[2fr_1.2fr_1fr_1.2fr_1.3fr] gap-2 border-b bg-[#FBF8F3] px-5 py-3 text-[12.5px] font-semibold">
              <div>ลูกค้า</div>
              <div>สถานะ</div>
              <div>การกระทำ</div>
              <div>โดย</div>
              <div>เวลา</div>
            </div>
            {(details?.data ?? []).length === 0 ? (
              <div className="text-ink-4 px-5 py-10 text-center text-[14px]">ไม่มีกิจกรรมในช่วงนี้</div>
            ) : (
              (details?.data ?? []).slice(0, 50).map((d) => (
                <div key={d.history_id} className="grid grid-cols-[2fr_1.2fr_1fr_1.2fr_1.3fr] gap-2 border-b px-5 py-3 text-[13.5px] last:border-0" style={{ borderColor: '#F2EDE5' }}>
                  <div className="truncate font-medium">{d.nb_customer_name}</div>
                  <div className="text-ink-2 truncate">{d.nb_status || '—'}</div>
                  <div className="text-ink-2">{d.action_type}</div>
                  <div className="text-ink-2 truncate">{d.action_by_name}</div>
                  <div className="text-ink-4 num">{d.created_at}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}

function SummaryCard({ value, label, tone, bg }: { value: number; label: string; tone: string; bg: string }) {
  return (
    <div className="border-border flex items-center gap-3 rounded-2xl border bg-white px-[18px] py-4 shadow-sm">
      <div className="size-2.5 rounded-full" style={{ background: tone }} />
      <div>
        <div className="num text-[25px] leading-none font-bold" style={{ color: tone }}>
          {value.toLocaleString('th-TH')}
        </div>
        <div className="text-ink-3 mt-1 text-[13px]">{label}</div>
      </div>
      <div className="ml-auto size-9 rounded-xl" style={{ background: bg }} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-ink-2 mb-2.5 text-[14px] font-semibold">{children}</div>;
}
