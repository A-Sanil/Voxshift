@echo off
setlocal EnableDelayedExpansion

echo ==========================================
echo  VoxShift — Windows Build Script
echo ==========================================
echo.

:: ── 1. Check prerequisites ────────────────────────────────────────────────
where node >nul 2>&1 || (echo [ERROR] Node.js not found. Install from https://nodejs.org && exit /b 1)
where python >nul 2>&1 || (echo [ERROR] Python not found. Install from https://python.org && exit /b 1)
where npm >nul 2>&1 || (echo [ERROR] npm not found && exit /b 1)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('python --version') do set PY_VER=%%v
echo Node  : %NODE_VER%
echo Python: %PY_VER%
echo.

:: ── 2. Install Node dependencies ──────────────────────────────────────────
echo [1/4] Installing Node dependencies...
call npm install
if %errorlevel% neq 0 (echo [ERROR] npm install failed && exit /b 1)
echo.

:: ── 3. Install Python dependencies ───────────────────────────────────────
echo [2/4] Installing Python dependencies...
cd python
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt --quiet
python -m pip install pyinstaller --quiet
if %errorlevel% neq 0 (echo [ERROR] pip install failed && exit /b 1)
echo.

:: ── 4. Build Python sidecar with PyInstaller ─────────────────────────────
echo [3/4] Compiling Python sidecar with PyInstaller...
python -m PyInstaller voxshift_sidecar.spec --clean --noconfirm
if %errorlevel% neq 0 (echo [ERROR] PyInstaller build failed && exit /b 1)
cd ..
echo.

:: ── 5. Build and package Electron app ────────────────────────────────────
echo [4/4] Building and packaging Electron app...
call npm run package
if %errorlevel% neq 0 (echo [ERROR] Electron build failed && exit /b 1)
echo.

:: ── Done ──────────────────────────────────────────────────────────────────
echo ==========================================
echo  Build complete!
echo ==========================================
for /f "tokens=2 delims=:" %%v in ('findstr /i "\"version\"" package.json ^| head -1') do (
    set VERSION=%%v
    set VERSION=!VERSION: =!
    set VERSION=!VERSION:"=!
    set VERSION=!VERSION:,=!
)
echo.
echo Installer: release\%VERSION%\VoxShift Setup %VERSION%.exe
echo.
endlocal
