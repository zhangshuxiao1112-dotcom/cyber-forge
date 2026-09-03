#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js。请先安装 Node.js 22 LTS：https://nodejs.org/"
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 22 ]; then
  echo "Node.js 版本过低。当前版本：$(node -v)，需要 Node.js 22 或更高版本。"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "首次运行：正在安装依赖……"
  npm ci
fi

echo "Cyber Forge 正在启动：http://localhost:3000"
npm run dev -- --host 0.0.0.0 --port 3000
