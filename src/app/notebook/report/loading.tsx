import { Skeleton } from '@/components/ui/skeleton';

// skeleton ระหว่างโหลด/สลับ period ของหน้า /notebook/report — เลียนโครง report/page.tsx เป๊ะ
export default function NotebookReportLoading() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-7 pt-[26px] pb-20">
      <Skeleton className="mb-4 h-4 w-32" />

      <div className="mb-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2.5 h-4 w-96 max-w-full" />
      </div>

      {/* period tabs */}
      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-[13px] p-1" style={{ background: '#F0EBE3' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-[10px] bg-white/70" />
        ))}
      </div>

      {/* summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-border flex items-center gap-3 rounded-2xl border bg-white px-[18px] py-4 shadow-sm"
          >
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
            <div>
              <Skeleton className="h-6 w-14" />
              <Skeleton className="mt-2 h-3.5 w-20" />
            </div>
            <Skeleton className="ml-auto size-9 rounded-xl" />
          </div>
        ))}
      </div>

      {/* ตารางสรุปต่อผู้ใช้ */}
      <Skeleton className="mb-2.5 h-4 w-28" />
      <SkeletonTable cols="grid-cols-[2fr_1fr_1fr_1fr]" rows={5} className="mb-8" />

      {/* ตารางกิจกรรมล่าสุด */}
      <Skeleton className="mb-2.5 h-4 w-28" />
      <SkeletonTable cols="grid-cols-[2fr_1.2fr_1fr_1.2fr_1.3fr]" rows={8} />
    </main>
  );
}

function SkeletonTable({ cols, rows, className }: { cols: string; rows: number; className?: string }) {
  const colCount = cols.split('_').length;
  return (
    <div className={`border-border overflow-hidden rounded-2xl border bg-white ${className ?? ''}`}>
      <div className={`grid ${cols} border-border gap-2 border-b bg-[#FBF8F3] px-5 py-3`}>
        {Array.from({ length: colCount }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`grid ${cols} gap-2 border-b px-5 py-3 last:border-0`} style={{ borderColor: '#F2EDE5' }}>
          {Array.from({ length: colCount }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
      ))}
    </div>
  );
}
