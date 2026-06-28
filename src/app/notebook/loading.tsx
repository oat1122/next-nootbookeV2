import { Skeleton } from '@/components/ui/skeleton';

// skeleton ระหว่างโหลด/สลับ tab ของหน้า /notebook — เลียนโครง page.tsx เป๊ะเพื่อกัน layout shift
// (top bar อยู่ใน layout.tsx จึงคงอยู่ ไม่ต้องทำ skeleton)
export default function NotebookLoading() {
  return (
    <main className="mx-auto w-full max-w-[1320px] px-7 pt-[26px] pb-20">
      {/* page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2.5 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>

      {/* scope tabs + entry filter */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-[13px] p-1" style={{ background: '#F0EBE3' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[38px] w-28 rounded-[10px] bg-white/70" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* stat cards */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-border flex items-center gap-3 rounded-2xl border bg-white px-[18px] py-4 shadow-sm"
          >
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="mt-2 h-3.5 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* toolbar: search + chips + view toggle */}
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <Skeleton className="h-11 min-w-[240px] flex-1 rounded-xl" />
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-[42px] w-[88px] rounded-xl" />
      </div>

      {/* result count */}
      <Skeleton className="mb-3 h-3.5 w-44" />

      {/* table */}
      <div className="border-border overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-border grid grid-cols-[2.4fr_1.5fr_1.2fr_1.4fr_1.5fr_1.3fr] gap-2 border-b bg-[#FBF8F3] px-5 py-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, r) => (
          <div
            key={r}
            className="grid grid-cols-[2.4fr_1.5fr_1.2fr_1.4fr_1.5fr_1.3fr] gap-2 border-b px-5 py-4"
            style={{ borderColor: '#F2EDE5' }}
          >
            {/* ลูกค้า: avatar + 2 บรรทัด */}
            <div className="flex items-start gap-2.5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-1.5 h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-24 self-center" />
            <Skeleton className="h-6 w-16 self-center rounded-full" />
            <Skeleton className="h-6 w-20 self-center rounded-full" />
            <Skeleton className="h-4 w-24 self-center" />
            <div className="flex items-center justify-end gap-1 self-center">
              <Skeleton className="size-[34px] rounded-[9px]" />
              <Skeleton className="size-[34px] rounded-[9px]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
