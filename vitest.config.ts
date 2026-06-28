import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// ทดสอบสูตรเงิน/ตรรกะบัญชีเป็นหลัก (ดู docesacc/01 §8, 06)
export default defineConfig({
  resolve: {
    // ให้ตรงกับ path alias @/* → src/* ใน tsconfig
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' throw นอก bundler ของ Next → stub ว่างตอนเทสต์ (ดู test/stubs/server-only.ts)
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
