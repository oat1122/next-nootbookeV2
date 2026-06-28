'use client';

import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * ตัวช่วยเรียก server action จาก client: ห่อ try/catch → toast → router.refresh()
 * (action ทำ revalidatePath('/notebook') อยู่แล้ว; refresh ดึง server component ใหม่)
 * `run` ห่อ useCallback ให้ identity นิ่ง เพื่อให้ context ที่อ้างถึงมัน memo ได้
 */
export function useNotebookAction() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = useCallback(
    <T,>(
      action: () => Promise<T>,
      opts: { success?: string; onDone?: (result: T) => void } = {},
    ) => {
      startTransition(async () => {
        try {
          const result = await action();
          if (opts.success) toast.success(opts.success);
          opts.onDone?.(result);
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด ลองอีกครั้ง');
        }
      });
    },
    [router],
  );

  return { pending, run };
}
