# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for VoxShift Python sidecar
# Build with: pyinstaller voxshift_sidecar.spec

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[],
    datas=[],
    hiddenimports=[
        # FastAPI / uvicorn internals
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.http.httptools_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'fastapi',
        'pydantic',
        'pydantic.deprecated.class_validators',
        'pydantic.deprecated.config',
        'pydantic.deprecated.tools',
        # audio
        'sounddevice',
        'numpy',
        # networking / scraping
        'httpx',
        'bs4',
        'lxml',
        'lxml.etree',
        'gdown',
        # DB
        'aiosqlite',
        'sqlite3',
    ],
    excludes=[
        # Exclude heavy ML deps — models are loaded at runtime, not bundled
        # Remove these if you want to bundle torch (adds ~3 GB)
        'torch',
        'torchaudio',
        'faiss',
        'librosa',
        'matplotlib',
        'IPython',
        'jupyter',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='voxshift_sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # keep console for log output visible in dev
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='voxshift_sidecar',
)
