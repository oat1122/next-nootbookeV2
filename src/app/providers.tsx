'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';

// TanStack Query สำหรับส่วน client ที่ต้องการ cache/refetch (ดู docesacc/01 §5)
// next-themes ขับ dark mode แบบ class (.dark) ให้ปุ่มสลับธีมใน Topbar ใช้ได้
// Motion (MOTION.md §5,§6): LazyMotion+domAnimation โหลด feature ชุดเล็ก, strict บังคับให้ใช้ m.* ทุกที่,
// MotionConfig reducedMotion="user" เคารพ prefers-reduced-motion รวมศูนย์ทั้งแอป
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000 } },
      }),
  );

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ThemeProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
