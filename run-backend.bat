@echo off
setlocal
cd /d "%~dp0backend"

if not exist ".venv\Scripts\activate.bat" (
  echo error: backend\.venv not found. Create it and install deps, e.g.: >&2
  echo   cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\activate ^&^& pip install -r requirements.txt ^&^& pip install -r requirements-llm.txt >&2
  exit /b 1
)

if not exist ".env" (
  echo warning: backend\.env missing. Add backend\.env and set GGUF_MODEL_PATH. >&2
)

call ".venv\Scripts\activate.bat"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
