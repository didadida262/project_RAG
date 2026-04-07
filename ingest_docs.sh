#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -d "$ROOT/backend/.venv" ]]; then
  echo "error: 请先创建 backend/.venv 并 pip install -r backend/requirements.txt" >&2
  exit 1
fi
exec "$ROOT/backend/.venv/bin/python" "$ROOT/ingest_docs.py" "$@"
