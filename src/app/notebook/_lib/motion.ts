import type { Transition } from 'motion/react';

// entrance ร่วมของ list/cards — fade + เลื่อนขึ้นเล็กน้อย (subtle/เร็ว)
// reducedMotion="user" ใน providers.tsx จัดการ prefers-reduced-motion ให้แล้ว จึงไม่ต้อง guard ที่นี่
export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

/** stagger หน่วงตาม index แต่ cap ไว้ไม่ให้รายการท้าย ๆ รอนาน (8 ใบ → ช้าสุด ~0.2s) */
export const riseStagger = (i = 0): Transition => ({
  duration: 0.2,
  ease: 'easeOut',
  delay: Math.min(i, 8) * 0.025,
});
