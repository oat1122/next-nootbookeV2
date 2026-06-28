// stub สำหรับเทสต์: 'server-only' ปกติจะ throw เมื่อ resolve นอก bundler ของ Next
// (vitest รันบน node ล้วน) — alias มาที่ไฟล์ว่างนี้ใน vitest.config.ts ให้ import โมดูล server
// ในเทสต์ได้โดยไม่พัง การป้องกัน client import จริงยังทำงานตามปกติตอน build ของ Next
export {};
