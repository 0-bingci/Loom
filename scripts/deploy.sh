#!/usr/bin/env bash
# 一条龙部署:构建前端 → 同步后端 → 迁移 → 重启服务 → 发布前端 → 自动 commit & push。
# 用法:
#   bash scripts/deploy.sh "本次改动说明"      # 带 commit 信息(推荐)
#   bash scripts/deploy.sh                       # 不传则用时间戳
# 依赖:能用 ~/.ssh/id_ed25519 免密 ssh 到服务器(root)。
set -euo pipefail

HOST="root@119.29.152.29"
SSH_KEY="$HOME/.ssh/id_ed25519"
SSH_OPTS="-o BatchMode=yes -o IdentitiesOnly=yes -i $SSH_KEY"
SSH="ssh $SSH_OPTS $HOST"
REMOTE_BACKEND="/opt/loom"
REMOTE_WEBROOT="/www/wwwroot/loom/dist"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"

echo "==> 1/6 构建前端"
npm --prefix frontend run build

echo "==> 2/6 同步后端源码(排除 node_modules / .env)"
tar -czf - --exclude='backend/node_modules' --exclude='backend/.env' backend \
  | $SSH "tar -xzf - -C $REMOTE_BACKEND"

echo "==> 3/6 安装依赖 + 迁移"
$SSH "cd $REMOTE_BACKEND/backend && /usr/bin/npm install --no-audit --no-fund >/dev/null 2>&1 && /usr/bin/npm run migrate"

echo "==> 4/6 重启服务"
$SSH "systemctl restart loom-api loom-worker && sleep 2 && systemctl is-active loom-api loom-worker"

echo "==> 5/6 发布前端"
$SSH "rm -rf $REMOTE_WEBROOT"
scp -q $SSH_OPTS -r frontend/dist "$HOST:$REMOTE_WEBROOT"
$SSH "curl -s -o /dev/null -w '   站点 HTTP %{http_code}\n' http://127.0.0.1:8090/"

echo "==> 6/6 提交并推送"
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$MSG"
else
  echo "   工作区无改动,跳过 commit"
fi
git push
echo "==> 完成 ✅"
