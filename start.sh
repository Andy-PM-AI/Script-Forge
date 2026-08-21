#!/usr/bin/env bash
# ScriptForge 一键启动：数据库 + 后端 + 前端
# 用法：./start.sh   （可重复执行；已在运行的服务会自动跳过）
set -euo pipefail
cd "$(dirname "$0")"

BACKEND_DIR="server"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-8443}"

C='\033[0;36m'; G='\033[0;32m'; Y='\033[1;33m'; N='\033[0m'
info() { printf "${C}[启动]${N} %s\n" "$*"; }
ok()   { printf "${G}[ OK ]${N} %s\n" "$*"; }
skip() { printf "${Y}[跳过]${N} %s\n" "$*"; }
port_listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# 1/3 数据库
info "1/3 数据库 (PostgreSQL/Docker)…"
docker compose -f "$BACKEND_DIR/docker-compose.yml" up -d
ok "数据库已就绪 (localhost:5432)"

# 2/3 后端
info "2/3 后端 (:${BACKEND_PORT})…"
if port_listening "$BACKEND_PORT"; then
  skip "端口 ${BACKEND_PORT} 已被占用，后端已在运行"
else
  (cd "$BACKEND_DIR" && nohup npm run dev > .dev.log 2>&1 &)
  ok "后端已启动 → http://localhost:${BACKEND_PORT}  （日志: ${BACKEND_DIR}/.dev.log）"
fi

# 3/3 前端
info "3/3 前端 (:${FRONTEND_PORT})…"
if port_listening "$FRONTEND_PORT"; then
  skip "端口 ${FRONTEND_PORT} 已被占用（通常由 Figma Make 自动启动）"
else
  (nohup npm run dev > .vite.log 2>&1 &)
  ok "前端已启动 → http://localhost:${FRONTEND_PORT}  （日志: .vite.log）"
fi

echo ""
printf "${G}全部就绪 ✓${N}\n"
echo "  前端   http://localhost:${FRONTEND_PORT}"
echo "  后端   http://localhost:${BACKEND_PORT}/health"
echo "  数据库 localhost:5432"
echo ""
echo "停止开发服务：./stop.sh"
