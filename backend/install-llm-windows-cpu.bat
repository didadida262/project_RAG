@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\activate.bat" (
  echo error: Create backend\.venv first: python -m venv .venv
  exit /b 1
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
echo Installing llama-cpp-python from pre-built CPU wheel ^(no CMake/VS build^)...
pip install --upgrade "llama-cpp-python>=0.3.1" --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu --prefer-binary
if errorlevel 1 exit /b 1
python -c "import llama_cpp; print('llama_cpp OK:', llama_cpp.__file__)"
endlocal
