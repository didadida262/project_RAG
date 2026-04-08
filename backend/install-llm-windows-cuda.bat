@echo off
REM NVIDIA GPU + CUDA 12.x：把下面 cu124 改成与你本机 CUDA 一致的 cu121 / cu122 / cu123 / cu124 / cu125
REM 需 Python 3.10 / 3.11 / 3.12（见 llama-cpp-python 文档）
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\activate.bat" (
  echo error: Create backend\.venv first: python -m venv .venv
  exit /b 1
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
set CUDA_TAG=cu124
pip install "llama-cpp-python>=0.3.1" --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/%CUDA_TAG% --prefer-binary
if errorlevel 1 exit /b 1
python -c "import llama_cpp; print('llama_cpp OK')"
endlocal
