from __future__ import annotations
import asyncio
import threading
import time
import random
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from schemas import TrainingJob

try:
    import torch
    TORCH_AVAILABLE = True
    DEVICE = (
        "cuda" if torch.cuda.is_available()
        else "mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        else "cpu"
    )
except Exception:
    TORCH_AVAILABLE = False
    DEVICE = "cpu"


def detect_hardware() -> dict:
    info = {"device": DEVICE, "torch_available": TORCH_AVAILABLE}
    if TORCH_AVAILABLE and DEVICE == "cuda":
        info["gpu_name"] = torch.cuda.get_device_name(0)
        info["vram_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
    return info


class ModelLoader:
    def __init__(self) -> None:
        self._loaded_id: Optional[str] = None
        self._model = None

    def load(self, model_id: str, file_path: str) -> bool:
        if self._loaded_id == model_id:
            return True
        self._unload()
        if not Path(file_path).exists():
            return False
        # Stub: real torch.load + model initialization goes here
        self._loaded_id = model_id
        return True

    def _unload(self) -> None:
        if self._model is not None:
            del self._model
            self._model = None
            if TORCH_AVAILABLE:
                try:
                    import torch
                    torch.cuda.empty_cache()
                except Exception:
                    pass
        self._loaded_id = None

    @property
    def loaded_id(self) -> Optional[str]:
        return self._loaded_id


class TrainingRunner:
    def __init__(self, broadcast_fn) -> None:
        self._broadcast = broadcast_fn
        self._active_job: Optional[dict] = None
        self._cancel_flag = threading.Event()

    def start(self, job: dict, file_paths: list[str]) -> None:
        self._cancel_flag.clear()
        self._active_job = job
        thread = threading.Thread(
            target=self._run,
            args=(job, file_paths),
            daemon=True
        )
        thread.start()

    def cancel(self) -> None:
        self._cancel_flag.set()

    def _run(self, job: dict, file_paths: list[str]) -> None:
        loop = asyncio.new_event_loop()
        try:
            for epoch in range(1, job["total_epochs"] + 1):
                if self._cancel_flag.is_set():
                    loop.run_until_complete(self._emit(job, epoch - 1, "cancelled"))
                    return

                # Simulate training step
                time.sleep(0.08 + random.random() * 0.04)
                loss = max(0.01, 2.0 * (1 - epoch / job["total_epochs"]) + random.gauss(0, 0.05))

                loop.run_until_complete(self._emit(job, epoch, "running", loss=loss))

                # Persist every 10 epochs
                if epoch % 10 == 0:
                    from database import update_training_job
                    loop.run_until_complete(update_training_job(job["id"], epoch, "running"))

            loop.run_until_complete(self._emit(job, job["total_epochs"], "completed"))
            from database import update_training_job
            loop.run_until_complete(update_training_job(job["id"], job["total_epochs"], "completed"))
        except Exception as e:
            print(f"[training] Error: {e}")
            loop.run_until_complete(self._emit(job, 0, "failed"))
        finally:
            loop.close()
            self._active_job = None

    async def _emit(self, job: dict, epoch: int, status: str, loss: float = 0.0) -> None:
        event = {
            "type": "training_progress",
            "job_id": job["id"],
            "epoch": epoch,
            "total": job["total_epochs"],
            "loss": round(loss, 4),
            "status": status
        }
        await self._broadcast(event)
