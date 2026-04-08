@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo error: backend\.venv not found. Create venv and: pip install -r backend\requirements.txt >&2
  exit /b 1
)

"%~dp0backend\.venv\Scripts\python.exe" "%~dp0ingest_docs.py" %*
