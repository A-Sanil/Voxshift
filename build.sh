#!/usr/bin/env bash
# VoxShift — macOS / Linux build script
set -euo pipefail

echo "=========================================="
echo " VoxShift — Build Script"
echo "=========================================="
echo ""

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
command -v node   >/dev/null 2>&1 || { echo "[ERROR] Node.js not found"; exit 1; }
command -v python3>/dev/null 2>&1 || { echo "[ERROR] Python 3 not found"; exit 1; }
command -v npm    >/dev/null 2>&1 || { echo "[ERROR] npm not found";      exit 1; }

echo "Node  : $(node -v)"
echo "Python: $(python3 --version)"
echo ""

# ── 2. Node deps ─────────────────────────────────────────────────────────────
echo "[1/4] Installing Node dependencies..."
npm install
echo ""

# ── 3. Python deps ───────────────────────────────────────────────────────────
echo "[2/4] Installing Python dependencies..."
cd python
python3 -m pip install --upgrade pip -q
python3 -m pip install -r requirements.txt -q
python3 -m pip install pyinstaller -q
echo ""

# ── 4. PyInstaller ───────────────────────────────────────────────────────────
echo "[3/4] Compiling Python sidecar..."
python3 -m PyInstaller voxshift_sidecar.spec --clean --noconfirm
cd ..
echo ""

# ── 5. Electron package ──────────────────────────────────────────────────────
echo "[4/4] Packaging Electron app..."
npm run package
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────
VERSION=$(node -p "require('./package.json').version")
echo "=========================================="
echo " Build complete! — v${VERSION}"
echo "=========================================="
echo ""
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "App: release/${VERSION}/VoxShift-${VERSION}.dmg"
else
  echo "App: release/${VERSION}/VoxShift-${VERSION}.AppImage"
fi
echo ""
