from __future__ import annotations
import argparse
import asyncio
import json
import time
import uvicorn
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
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

# ── State ────────────────────────────────────────────────────────────────────

audio_engine = AudioEngine()
model_loader = ModelLoader()
ws_clients: set[WebSocket] = set()
_training_runner: Optional[TrainingRunner] = None
_active_job: Optional[dict] = None


# ── WebSocket broadcast ───────────────────────────────────────────────────────

async def broadcast(event: dict) -> None:
    dead = set()
    for ws in ws_clients:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            dead.add(ws)
    ws_clients.difference_update(dead)


# ── Waveform pump (runs in background) ───────────────────────────────────────

async def waveform_pump() -> None:
    import math, random
    t = 0.0
    while True:
        await asyncio.sleep(1 / 30)
        if audio_engine.is_running:
            # Engine sets amplitudes via callback; pump last known values
            pass
        t += 0.1


def amplitude_cb(amplitudes: list[float]) -> None:
    asyncio.run_coroutine_threadsafe(
        broadcast({"type": "waveform", "amplitudes": amplitudes}),
        asyncio.get_event_loop()
    )


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
    allow_headers=["*"]
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Models ────────────────────────────────────────────────────────────────────

@app.get("/api/models", response_model=list[VoiceModel])
async def get_models():
    return await get_all_models()


@app.post("/api/models", response_model=VoiceModel, status_code=201)
async def create_model(req: CreateModelRequest):
    model = VoiceModel(
        name=req.name,
        source_type=req.source_type,
        file_path=req.file_path,
        index_path=req.index_path,
        avatar=req.avatar,
        category=req.category
    )
    await insert_model(model.model_dump())
    return model


@app.delete("/api/models/{model_id}", status_code=204)
async def remove_model(model_id: str):
    await delete_model(model_id)


# ── Devices ───────────────────────────────────────────────────────────────────

@app.get("/api/devices", response_model=DevicesResponse)
async def get_devices():
    return DevicesResponse(
        input=[AudioDevice(**d) for d in list_input_devices()],
        output=[AudioDevice(**d) for d in list_output_devices()]
    )


# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/api/settings", response_model=AppSettings)
async def get_settings():
    stored = await get_all_settings()
    defaults = AppSettings()
    return AppSettings(**{**defaults.model_dump(), **stored})


@app.put("/api/settings", response_model=AppSettings)
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
    global _active_job
    if _active_job and _active_job.get("status") == "running":
        raise HTTPException(400, "Training is running; pause it before activating voice changer")

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

@app.post("/api/train", response_model=TrainingJob, status_code=201)
async def start_training(req: TrainRequest):
    global _training_runner, _active_job

    audio_engine.stop()
    await broadcast({"type": "audio_status", "status": "idle"})

    job = TrainingJob(
        model_name=req.model_name,
        total_epochs=req.total_epochs
    )
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


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.add(ws)
    try:
        while True:
            # Keep connection alive; all pushes are server-initiated
            await asyncio.sleep(5)
            await ws.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    except Exception:
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
