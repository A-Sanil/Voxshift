"""
Downloads RVC model files from HuggingFace, Google Drive, etc.
Streams progress back via a callback so the WebSocket can broadcast it.
"""
from __future__ import annotations
import asyncio
import os
import re
import zipfile
import shutil
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

import httpx

MODELS_DIR = Path(os.environ.get("VOXSHIFT_MODELS_DIR", Path.home() / ".voxshift" / "models"))

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def sanitize_name(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip("_. ")[:120]


def gdrive_file_id(url: str) -> Optional[str]:
    m = re.search(r"/file/d/([a-zA-Z0-9_-]+)", url)
    return m.group(1) if m else None


def gdrive_folder_id(url: str) -> Optional[str]:
    m = re.search(r"/folders/([a-zA-Z0-9_-]+)", url)
    return m.group(1) if m else None


async def _download_stream(
    client: httpx.AsyncClient,
    url: str,
    dest: Path,
    progress_cb: Callable[[int, int], None],
    headers: dict | None = None,
) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    async with client.stream("GET", url, headers=req_headers, follow_redirects=True) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        with open(dest, "wb") as f:
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                f.write(chunk)
                downloaded += len(chunk)
                progress_cb(downloaded, total)
    return dest


async def _download_gdrive_file(
    file_id: str,
    dest: Path,
    progress_cb: Callable[[int, int], None],
) -> Path:
    """Download a single Google Drive file, handling the virus-scan confirmation page."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=300) as client:
        # First request — may get a confirmation page for large files
        url = f"https://drive.google.com/uc?export=download&id={file_id}"
        resp = await client.get(url, headers={"User-Agent": USER_AGENT})

        # Check if we need to confirm (virus scan warning)
        if "confirm=" in str(resp.url) or b"virus scan" in resp.content.lower():
            # Extract confirm token
            token_m = re.search(rb'confirm=([a-zA-Z0-9_-]+)', resp.content)
            if token_m:
                confirm_token = token_m.group(1).decode()
                url = f"https://drive.google.com/uc?export=download&id={file_id}&confirm={confirm_token}"
            else:
                # Try the newer download URL pattern
                url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t"

        dest.parent.mkdir(parents=True, exist_ok=True)
        return await _download_stream(client, url, dest, progress_cb)


def _extract_zip(zip_path: Path, extract_dir: Path) -> list[Path]:
    """Extract .zip and return list of extracted .pth and .index files."""
    extracted = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.infolist():
            name = member.filename
            if name.endswith((".pth", ".index")):
                # Flatten directory structure
                flat_name = Path(name).name
                dest = extract_dir / flat_name
                with zf.open(member) as src, open(dest, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                extracted.append(dest)
    return extracted


async def download_model(
    model_id: str,
    model_name: str,
    download_url: str,
    download_type: str,
    progress_cb: Callable[[dict], None],  # called with {downloaded, total, phase, error?}
) -> dict:
    """
    Download and install a voice model.
    Returns {pth_path, index_path, model_dir} on success.
    Raises on failure.
    """
    safe_name = sanitize_name(model_name)
    model_dir = MODELS_DIR / safe_name
    model_dir.mkdir(parents=True, exist_ok=True)

    def _prog(downloaded: int, total: int, phase: str = "downloading") -> None:
        progress_cb({"downloaded": downloaded, "total": total, "phase": phase})

    pth_path: Optional[Path] = None
    index_path: Optional[Path] = None

    try:
        if download_type == "huggingface":
            # HuggingFace — usually a direct .zip or .pth URL
            filename = Path(urlparse(download_url).path).name or "model.zip"
            dest = model_dir / filename

            async with httpx.AsyncClient(follow_redirects=True, timeout=300) as client:
                await _download_stream(client, download_url, dest, lambda d, t: _prog(d, t))

            if filename.endswith(".zip"):
                progress_cb({"downloaded": 0, "total": 0, "phase": "extracting"})
                extracted = _extract_zip(dest, model_dir)
                dest.unlink(missing_ok=True)
                for f in extracted:
                    if f.suffix == ".pth":
                        pth_path = f
                    elif f.suffix == ".index":
                        index_path = f
            elif filename.endswith(".pth"):
                pth_path = dest
            else:
                # Unknown — keep as-is, rename to .pth
                renamed = dest.with_suffix(".pth")
                dest.rename(renamed)
                pth_path = renamed

        elif download_type == "gdrive":
            file_id = gdrive_file_id(download_url)
            folder_id = gdrive_folder_id(download_url)

            if file_id:
                # Single file — determine filename from model name
                dest = model_dir / f"{safe_name}.pth"
                try:
                    await _download_gdrive_file(file_id, dest, lambda d, t: _prog(d, t))
                    if zipfile.is_zipfile(dest):
                        progress_cb({"downloaded": 0, "total": 0, "phase": "extracting"})
                        extracted = _extract_zip(dest, model_dir)
                        dest.unlink(missing_ok=True)
                        for f in extracted:
                            if f.suffix == ".pth":
                                pth_path = f
                            elif f.suffix == ".index":
                                index_path = f
                    else:
                        pth_path = dest
                except Exception as e:
                    raise RuntimeError(f"Google Drive download failed: {e}. Try downloading manually from: {download_url}")

            elif folder_id:
                # Google Drive folder — try gdown
                try:
                    import gdown  # type: ignore
                    gdown.download_folder(
                        id=folder_id,
                        output=str(model_dir),
                        quiet=True,
                        use_cookies=False,
                    )
                    for f in model_dir.rglob("*.pth"):
                        pth_path = f
                        break
                    for f in model_dir.rglob("*.index"):
                        index_path = f
                        break
                except Exception as e:
                    raise RuntimeError(f"Google Drive folder download failed: {e}. Open manually: {download_url}")
            else:
                raise ValueError(f"Could not parse Google Drive URL: {download_url}")

        else:
            # Direct or unknown URL — try streaming download
            filename = Path(urlparse(download_url).path).name or f"{safe_name}.pth"
            dest = model_dir / filename
            async with httpx.AsyncClient(follow_redirects=True, timeout=300) as client:
                await _download_stream(client, download_url, dest, lambda d, t: _prog(d, t))
            if dest.suffix == ".zip" or zipfile.is_zipfile(dest):
                progress_cb({"downloaded": 0, "total": 0, "phase": "extracting"})
                extracted = _extract_zip(dest, model_dir)
                dest.unlink(missing_ok=True)
                for f in extracted:
                    if f.suffix == ".pth":
                        pth_path = f
                    elif f.suffix == ".index":
                        index_path = f
            else:
                pth_path = dest if dest.suffix == ".pth" else dest.with_suffix(".pth")
                if dest != pth_path:
                    dest.rename(pth_path)

    except Exception as e:
        # Clean up empty dir if nothing was saved
        if model_dir.exists() and not any(model_dir.iterdir()):
            model_dir.rmdir()
        raise

    progress_cb({"downloaded": 0, "total": 0, "phase": "done"})

    return {
        "model_dir": str(model_dir),
        "pth_path": str(pth_path) if pth_path else None,
        "index_path": str(index_path) if index_path else None,
    }
