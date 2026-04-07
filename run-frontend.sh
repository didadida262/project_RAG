#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/frontend"

if [[ ! -d node_modules ]]; then
  echo "正在安装 npm 依赖…"
  npm install
fi

exec npm run dev
