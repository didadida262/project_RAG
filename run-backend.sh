#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/backend"

if [[ ! -d .venv ]]; then
  echo "error: backend/.venv 不存在，请先创建并安装依赖：" >&2
  echo "  cd backend && python3 -m venv .venv && source .venv/bin/activate \\" >&2
  echo "    && pip install -r requirements.txt && pip install -r requirements-llm.txt" >&2
  exit 1
fi

# shellcheck source=/dev/null
source .venv/bin/activate

if [[ ! -f .env ]]; then
  echo "warning: backend/.env 不存在，请添加 backend/.env 并填写 GGUF_MODEL_PATH" >&2
fi

exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
