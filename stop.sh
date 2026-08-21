#!/usr/bin/env bash
# 停止本地 dev 服务（后端 :3001、前端 :8443）；数据库容器默认保留
set -euo pipefail

stop_port() {
  local port="$1"
  local pids
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "停止端口 $port 上的进程: $pids"
    kill $pids 2>/dev/null || true
  else
    echo "端口 $port 没有运行中的进程"
  fi
}

stop_port 3001
stop_port 8443

echo ""
echo "数据库容器仍保持运行。如需一并停止："
echo "  docker compose -f server/docker-compose.yml down"
