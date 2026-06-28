import { cn } from '@/lib/utils';

/**
 * บล็อกโครงร่าง (skeleton) พื้นฐาน — ใช้เป็น "อะตอม" ของทุกหน้าโหลด
 * เลือกสีพื้นเป็น border-2 เพื่อให้มองเห็นทั้งบนการ์ดสีขาว (bg-surface) และบนพื้นหน้า
 * สีเทา (bg-background) ทั้งโหมดสว่าง/มืด — ปรับขนาด/รัศมีเพิ่มผ่าน className ได้
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-border-2 animate-pulse rounded-md', className)}
      {...props}
    />
  );
}
