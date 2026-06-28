// app.js — Passenger startup file (CommonJS) สำหรับ Plesk
// ตั้ง Plesk > Node.js > Application Startup File = app.js (อย่าชี้ที่ server.ts)
//
// ทำไมต้องมีไฟล์นี้: Passenger รัน startup file ด้วย node ตรง ๆ แบบ CommonJS — โหลด server.ts
// (TypeScript + ESM `import`) ไม่ได้ → "Cannot use import statement outside a module".
// แก้โดย register tsx runtime ก่อน แล้วค่อย require('./server.ts') ให้ tsx แปลง TS+ESM ตอนรัน
// (ตรงกับ `npm start` = cross-env NODE_ENV=production tsx server.ts)
//
// ponytail: ไม่ precompile เป็น dist/server.js — tsx เป็น dependency อยู่แล้วและ start script ก็ใช้ tsx
//   เลี่ยง build step + config ซ้ำซ้อน. ถ้าต้องตัด tsx ออกจาก prod ค่อยเปลี่ยนไป precompile ทีหลัง
// ponytail: ไฟล์เป็น .js + ไม่มี "type":"module" ใน package.json → node อ่านเป็น CommonJS (require ใช้ได้)
//   ถ้าวันหน้าเพิ่ม "type":"module" ต้องเปลี่ยนไฟล์นี้เป็น app.cjs
process.env.NODE_ENV ||= 'production'
// eslint-disable-next-line @typescript-eslint/no-require-imports -- ตั้งใจเป็น CommonJS: Passenger รัน node ตรง ๆ จะ import ESM ไม่ได้
require('tsx/cjs')
// eslint-disable-next-line @typescript-eslint/no-require-imports -- โหลด server.ts ผ่าน tsx ที่เพิ่ง register
require('./server.ts')
