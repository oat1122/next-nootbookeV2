# next-nootbookeV2 (Notebook V2) — Next.js 16 (App Router) + custom Express server (server.ts, ไม่ใช่ standalone)
# serve ผ่าน `pnpm start` = cross-env NODE_ENV=production tsx server.ts (ดู package.json / server.ts)
# ต่อ MariaDB กลาง shared-mariadb ผ่าน shared-net (ดู E:\deploy-vps\deploy-guide.md)
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable            # pnpm@10.33.2 มาจาก field packageManager ใน package.json

# ---- deps (layer cache) ----
# ไม่ตั้ง NODE_ENV=production ตอน install — ต้องได้ devDeps (tailwind/typescript) มา build ด้วย
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# ---- build ----
# ข้าม env validation (@t3-oss) ตอน build — ไม่มี NEXT_PUBLIC/client var จึงไม่ bake ค่าใด ๆ ลง bundle
# ค่า env จริง (DB/cookie/origin) inject ตอน runtime ผ่าน compose env_file .env
COPY . .
RUN SKIP_ENV_VALIDATION=1 pnpm build

EXPOSE 3000
# ponytail: single-stage เก็บ devDeps ไว้ในภาพด้วย — แลกขนาดภาพกับความเรียบง่าย. ถ้าต้องรีดขนาดค่อย
#   แยก multistage + `pnpm prune --prod` ทีหลัง (tsx/cross-env/express/next อยู่ใน dependencies อยู่แล้ว)
CMD ["pnpm", "start"]
