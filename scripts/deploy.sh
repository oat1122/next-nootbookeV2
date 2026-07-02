#!/usr/bin/env bash
# Deploy next-nootbookeV2 บน VPS — รันจาก CI (.github/workflows/deploy.yml) หรือมือก็ได้:
#   cd ~/apps/next-notebookv2 && git pull && bash scripts/deploy.sh
#
# ── bootstrap ครั้งแรกบน VPS (ทำครั้งเดียว) ──────────────────────────
#   # 1) deploy key ให้ VPS ดึง repo private ได้ (read-only):
#   ssh-keygen -t ed25519 -f ~/.ssh/notebookv2_deploy -N "" -C "vps-notebookv2"
#   cat ~/.ssh/notebookv2_deploy.pub   # -> เพิ่มใน GitHub repo Settings → Deploy keys (อ่านอย่างเดียว)
#   cat >> ~/.ssh/config <<'EOF'
#   Host github-notebookv2
#     HostName github.com
#     User git
#     IdentityFile ~/.ssh/notebookv2_deploy
#   EOF
#   # 2) ผูก repo เข้า path ที่รันอยู่ (ดู deploy-vps/apps/README.md — โฟลเดอร์ = ~/apps/notebookv2):
#   #   ยังไม่มีโฟลเดอร์  -> git clone github-notebookv2:oat1122/next-nootbookeV2.git ~/apps/notebookv2
#   #   deploy มือไว้ก่อน -> cd ~/apps/notebookv2 && git init -b main && \
#   #       git remote add origin github-notebookv2:oat1122/next-nootbookeV2.git
#   #       (CI จะ git fetch + reset --hard origin/main ให้เองรอบแรก; .env untracked เหลือรอด)
#   cd ~/apps/notebookv2
#   # 3) สร้าง .env prod (gitignored, deploy จะไม่แตะ) แล้ว chmod 600:
#   cp .env.production .env   # หรือวางค่าจริงเอง (DB_HOST=shared-mariadb ฯลฯ)
#   chmod 600 .env
#   # 4) ยิงครั้งแรก + เปิด nginx/SSL (ดู deploy-vps/deploy-guide.md ข้อ 4):
#   bash scripts/deploy.sh
#   sudo ln -sf /etc/nginx/sites-available/notebookv2 /etc/nginx/sites-enabled/
#   sudo nginx -t && sudo systemctl reload nginx
#   sudo certbot --nginx -d notebookv2.thanaplus-webapp.tech --non-interactive \
#     --agree-tos -m oat0967687027@gmail.com --redirect
set -euo pipefail

cd "$(dirname "$0")/.." # repo root ไม่ว่าถูกเรียกจากไหน

# build fail = compose ไม่สลับ container -> เวอร์ชันเก่ายังรัน (ไม่ downtime)
docker compose up -d --build
docker image prune -f # ทิ้ง image เก่าที่ dangling หลัง rebuild
docker compose ps

# health check: port 3003 ตอบไหม (รับทุก HTTP code รวม 401/302 = แอป serve อยู่; fail แค่ตอนต่อไม่ติด)
echo "waiting for app on 127.0.0.1:3003 ..."
for i in $(seq 1 15); do
  if curl -sS -o /dev/null -m 5 http://127.0.0.1:3003; then
    echo "✅ deploy ok — app ตอบแล้ว"
    exit 0
  fi
  sleep 2
done
echo "❌ health check ล้มเหลว — app ไม่ตอบใน 30s (ดู: docker compose logs -f)" >&2
exit 1
