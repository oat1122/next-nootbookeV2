import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import express, { type Request } from 'express'
import next from 'next'

// custom server = production serve entry ของโปรเจค (ดู next.config.ts ที่ตัด output:'standalone' ออกแล้ว
// เพราะ Next ระบุว่า custom server + standalone ใช้ร่วมกันไม่ได้). socket.io ยังไม่ใส่ — เผื่อ wrap httpServer
// ตอนต้องการ realtime ภายหลัง. auth ของแอปเป็น Sanctum authToken ที่เช็คในชั้น app (getCurrentUser) —
// server.ts ตั้งใจไม่ decode token ที่นี่ (เลี่ยงเปิด DB pool ซ้ำ + คัปปลิ้งกับ src/server/auth)
const port = parseInt(process.env.PORT ?? '', 10) || 3000
const dev = process.env.NODE_ENV !== 'production'

const app = next({ dev })
const handle = app.getRequestHandler()

// Diagnostic: log สาเหตุการตายแต่ละรอบ + memory ตอนตาย แยกให้ออกว่า process manager (PM2/Passenger) kill
// (memory/watch) หรือ app crash (uncaught/unhandled). ดูใน log ของ process manager ว่า "kind" เป็นอะไร
const logFatal = (kind: string, extra?: Record<string, unknown>) => {
  const mem = process.memoryUsage()
  console.error(
    JSON.stringify({
      level: 'fatal',
      service: 'next-accountv2-server',
      kind,
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      uptimeSec: Math.round(process.uptime()),
      ...extra,
    }),
  )
}

process.on('uncaughtException', (err) => {
  logFatal('uncaughtException', { err: err.stack ?? String(err) })
  // ponytail: exit เฉพาะ prod (ให้ process manager restart). dev รันไฟล์นี้เหมือนกัน — อย่าฆ่า dev server
  if (!dev) process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  logFatal('unhandledRejection', {
    reason: reason instanceof Error ? reason.stack : String(reason),
  })
  if (!dev) process.exit(1)
})
// process manager ส่ง SIGINT/SIGTERM ก่อน kill (รวมตอน max_memory_restart) — rssMB บอกได้ว่าชน limit ไหม
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logFatal('signal', { signal })
    process.exit(0)
  })
}

// Access log: IP / method / path / เมื่อไหร่ — แบบอ่านง่าย เก็บแยกรายวันใน server/logs/access-DD-MM-YYYY.log
// ตั้งใจ "ไม่" decode identity ที่นี่ (โปรเจคใช้ Sanctum authToken ที่เช็คในชั้น app ไม่ใช่ NextAuth) —
// เลี่ยง DB lookup ต่อ request + ไม่ผูก server.ts เข้ากับ src/server/auth
// ponytail: process.cwd() แทน __dirname — server.ts อยู่ที่ root + launcher (tsx/PM2/Passenger) chdir เข้า
// app root ก่อนรัน → ค่าเท่ากัน แต่ใช้ได้ทั้ง CJS/ESM
const ACCESS_LOG_DIR = path.join(process.cwd(), 'server', 'logs')
fs.mkdirSync(ACCESS_LOG_DIR, { recursive: true })

// log เฉพาะหน้าเพจ + API ที่ผู้ใช้เรียกจริง — ข้าม asset/_next/favicon
const SKIP_ACCESS_LOG =
  /^\/(?:_next|favicon|static)\b|\.(?:js|css|map|ico|png|jpe?g|gif|svg|webp|woff2?|ttf)$/i

const pad2 = (n: number) => String(n).padStart(2, '0')

const accessLogPath = () => {
  const d = new Date()
  return path.join(
    ACCESS_LOG_DIR,
    `access-${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}.log`,
  )
}

const stamp = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`

// prod อยู่หลัง proxy → remoteAddress = 127.0.0.1. ตั้ง `trust proxy` ไว้แล้ว (ดู app.prepare ด้านล่าง)
// → req.ip ถอด X-Forwarded-For ให้เป็น client จริง; เผื่อ proxy ใส่แค่ x-real-ip (ไม่มี XFF) ก็ fallback ไปตัวนั้น
const clientIp = (req: Request): string => {
  if (!req.headers['x-forwarded-for']) {
    const realIp = req.headers['x-real-ip']
    if (typeof realIp === 'string' && realIp) return realIp
  }
  return req.ip ?? req.socket?.remoteAddress ?? '-'
}

// ponytail: fire-and-forget — append error ถูกกลืน ห้ามให้ log line ทำ request พัง
const writeAccessLog = (req: Request) => {
  const urlPath = (req.url ?? '/').split('?')[0]
  if (SKIP_ACCESS_LOG.test(urlPath)) return
  const line = `${stamp(new Date())}  ${clientIp(req).padEnd(15)}  ${(req.method ?? '-').padEnd(6)} ${urlPath}\n`
  fs.appendFile(accessLogPath(), line, () => {})
}

app.prepare().then(() => {
  const expressApp = express()

  // prod อยู่หลัง reverse proxy 1 ชั้น (proxy → Express บน loopback) → trust hop เดียว
  // ให้ req.ip / req.protocol / req.secure อ่านจาก X-Forwarded-* ได้ถูก (Next อ่าน header ดิบเองอยู่แล้ว
  // ไม่กระทบ — ค่านี้มีผลเฉพาะ helper ของ Express เช่น clientIp ใน access log). ตั้ง 1 ไม่ใช่ true
  // เพื่อไม่หลงเชื่อ XFF ที่ถูก spoof มาเกินจำนวน proxy จริง
  expressApp.set('trust proxy', 1)

  expressApp.use((req, _res, expressNext) => {
    writeAccessLog(req)
    expressNext()
  })

  // Express 5: catch-all ต้องเป็น app.use(handler) — app.all('*') จะ throw (path-to-regexp v8 ต้องการ
  // ชื่อ wildcard). ส่งทุก request ที่เหลือให้ Next จัดการ
  expressApp.use((req, res) => {
    handle(req, res)
  })

  expressApp.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? 'development' : 'production'})`)
  })
})
