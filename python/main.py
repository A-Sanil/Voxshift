from __future__ import annotations
import argparse
import asyncio
import json
import threading
import uvicorn
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from database import (
    init_db, get_all_models, insert_model, delete_model,
    get_all_settings, set_setting, upsert_training_job, update_training_job
)
from schemas import (
    VoiceModel, CreateModelRequest, AppSettings, AppSettingsPatch,
    DevicesResponse, AudioDevice, TrainRequest, TrainingJob
)
from audio import AudioEngine, list_input_devices, list_output_devices
from inference import ModelLoader, TrainingRunner, detect_hardware
from scraper import scrape_models
from downloader import download_model

# ── Singletons ────────────────────────────────────────────────────────────────

audio_engine = AudioEngine()
model_loader = ModelLoader()
ws_clients: set[WebSocket] = set()
_training_runner: Optional[TrainingRunner] = None
_active_job: Optional[dict] = None
_active_downloads: dict[str, dict] = {}  # model_id → progress

# ── WebSocket broadcast ───────────────────────────────────────────────────────

async def broadcast(event: dict) -> None:
    dead = set()
    for ws in ws_clients:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            dead.add(ws)
    ws_clients.difference_update(dead)


def broadcast_sync(event: dict) -> None:
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(broadcast(event), loop)
    except RuntimeError:
        pass


# ── Amplitude callback ────────────────────────────────────────────────────────

def amplitude_cb(amplitudes: list[float]) -> None:
    broadcast_sync({"type": "waveform", "amplitudes": amplitudes})


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    audio_engine.set_amplitude_callback(amplitude_cb)
    hw = detect_hardware()
    print(f"[voxshift] hardware: {hw}")
    print(f"[voxshift] ready")
    yield
    audio_engine.stop()


app = FastAPI(title="VoxShift", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Models (local library) ────────────────────────────────────────────────────

@app.get("/api/models")
async def get_models():
    return await get_all_models()


@app.post("/api/models", status_code=201)
async def create_model(req: CreateModelRequest):
    model = VoiceModel(
        name=req.name,
        source_type=req.source_type,
        file_path=req.file_path,
        index_path=req.index_path,
        avatar=req.avatar,
        category=req.category,
    )
    await insert_model(model.model_dump())
    return model


@app.delete("/api/models/{model_id}", status_code=204)
async def remove_model(model_id: str):
    await delete_model(model_id)


# ── Devices ───────────────────────────────────────────────────────────────────

@app.get("/api/devices")
async def get_devices():
    return DevicesResponse(
        input=[AudioDevice(**d) for d in list_input_devices()],
        output=[AudioDevice(**d) for d in list_output_devices()],
    )


# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/api/settings")
async def get_settings():
    stored = await get_all_settings()
    return AppSettings(**{**AppSettings().model_dump(), **stored})


@app.put("/api/settings")
async def update_settings(patch: AppSettingsPatch):
    data = patch.model_dump(exclude_none=True)
    for k, v in data.items():
        await set_setting(k, v)
    audio_engine.set_settings(data)
    stored = await get_all_settings()
    return AppSettings(**{**AppSettings().model_dump(), **stored})


# ── Audio ─────────────────────────────────────────────────────────────────────

@app.post("/api/audio/start")
async def start_audio():
    if _active_job and _active_job.get("status") == "running":
        raise HTTPException(400, "Training is running — stop it first")
    ok = audio_engine.start()
    status = "live" if ok else "error"
    await broadcast({"type": "audio_status", "status": status})
    return {"status": status}


@app.post("/api/audio/stop")
async def stop_audio():
    audio_engine.stop()
    await broadcast({"type": "audio_status", "status": "idle"})
    return {"status": "idle"}


# ── Training ──────────────────────────────────────────────────────────────────

@app.post("/api/train", status_code=201)
async def start_training(req: TrainRequest):
    global _training_runner, _active_job
    audio_engine.stop()
    await broadcast({"type": "audio_status", "status": "idle"})
    job = TrainingJob(model_name=req.model_name, total_epochs=req.total_epochs)
    _active_job = job.model_dump()
    await upsert_training_job(_active_job)
    _training_runner = TrainingRunner(broadcast)
    _training_runner.start(_active_job, req.file_paths)
    return job


@app.post("/api/train/{job_id}/cancel")
async def cancel_training(job_id: str):
    global _training_runner, _active_job
    if _training_runner:
        _training_runner.cancel()
    if _active_job and _active_job["id"] == job_id:
        await update_training_job(job_id, _active_job.get("current_epoch", 0), "cancelled")
        _active_job = None
    return {"status": "cancelled"}


# ── Marketplace ───────────────────────────────────────────────────────────────

@app.get("/api/marketplace")
async def marketplace(
    page: int = 1,
    search: str = "",
    sort: str = "new",
    category: str = "All",
):
    """Proxy voice-models.com with 5-minute cache."""
    try:
        result = await scrape_models(page=page, search=search, sort=sort, category=category)
        return result
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch marketplace: {e}")


@app.post("/api/marketplace/download")
async def start_download(body: dict, background_tasks: BackgroundTasks):
    """
    Begin downloading a marketplace model in the background.
    Broadcasts progress via WebSocket as:
      {type: "download_progress", model_id, downloaded, total, phase}
    """
    model_id: str = body.get("id", "")
    model_name: str = body.get("name", "Unknown Voice")
    download_url: str = body.get("download_url", "")
    download_type: str = body.get("download_type", "direct")
    avatar: str = body.get("avatar", "🎤")
    category: str = body.get("category", "Character")

    if not download_url:
        raise HTTPException(400, "download_url is required")

    if model_id in _active_downloads:
        return {"status": "already_downloading"}

    _active_downloads[model_id] = {"phase": "starting", "downloaded": 0, "total": 0}

    async def _run():
        def _progress(info: dict):
            _active_downloads[model_id] = info
            broadcast_sync({
                "type": "download_progress",
                "model_id": model_id,
                **info,
            })

        try:
            result = await download_model(
                model_id=model_id,
                model_name=model_name,
                download_url=download_url,
                download_type=download_type,
                progress_cb=_progress,
            )
            # Register in local library
            from database import insert_model as _insert
            import uuid
            from datetime import datetime
            new_model = {
                "id": str(uuid.uuid4()),
                "name": model_name,
                "source_type": "marketplace",
                "file_path": result.get("pth_path") or "",
                "index_path": result.get("index_path"),
                "avatar": avatar,
                "category": category,
                "added_at": datetime.utcnow().isoformat(),
            }
            await _insert(new_model)
            broadcast_sync({
                "type": "download_complete",
                "model_id": model_id,
                "model": new_model,
            })
        except Exception as e:
            broadcast_sync({
                "type": "download_error",
                "model_id": model_id,
                "error": str(e),
            })
        finally:
            _active_downloads.pop(model_id, None)

    background_tasks.add_task(_run)
    return {"status": "started"}


@app.delete("/api/cache", status_code=204)
async def clear_cache():
    from scraper import _cache
    _cache.clear()


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.add(ws)
    try:
        while True:
            await asyncio.sleep(5)
            await ws.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        ws_clients.discard(ws)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
