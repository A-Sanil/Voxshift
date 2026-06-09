from __future__ import annotations
import asyncio
import threading
import time
import random
import numpy as np
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
    """
    Loads and manages RVC voice conversion models.
    
    TODO: Implement full RVC model loading:
    1. Load .pth checkpoint (contains model weights)
    2. Load .index file (FAISS index for feature matching)
    3. Initialize HuBERT feature extractor
    4. Initialize pitch extractor (RMVPE/Harvest/Dio)
    5. Initialize vocoder (NSF-HiFiGAN)
    """
    
    def __init__(self) -> None:
        self._loaded_id: Optional[str] = None
        self._model = None
        self._index = None
        self._hubert = None
        self._pitch_extractor = None
        self._vocoder = None

    def load(self, model_id: str, file_path: str, index_path: Optional[str] = None) -> bool:
        """
        Load an RVC model from disk.
        
        Args:
            model_id: Unique identifier for the model
            file_path: Path to .pth model file
            index_path: Optional path to .index FAISS file
            
        Returns:
            True if loaded successfully, False otherwise
        """
        if self._loaded_id == model_id:
            return True
        
        self._unload()
        
        if not Path(file_path).exists():
            print(f"[model] File not found: {file_path}")
            return False
        
        try:
            if TORCH_AVAILABLE:
                import torch
                
                # Load model checkpoint
                checkpoint = torch.load(file_path, map_location=DEVICE)
                print(f"[model] Loaded checkpoint from {file_path}")
                
                # TODO: Initialize RVC model architecture
                # self._model = RVCModel(checkpoint['config'])
                # self._model.load_state_dict(checkpoint['model'])
                # self._model.to(DEVICE)
                # self._model.eval()
                
                # Load FAISS index if provided
                if index_path and Path(index_path).exists():
                    try:
                        import faiss
                        self._index = faiss.read_index(index_path)
                        print(f"[model] Loaded FAISS index from {index_path}")
                    except Exception as e:
                        print(f"[model] Failed to load index: {e}")
                
                # TODO: Load HuBERT, pitch extractor, vocoder
                # self._hubert = load_hubert_model()
                # self._pitch_extractor = load_pitch_extractor()
                # self._vocoder = load_vocoder()
                
                self._loaded_id = model_id
                print(f"[model] Model {model_id} loaded successfully")
                return True
            else:
                print("[model] PyTorch not available")
                return False
                
        except Exception as e:
            print(f"[model] Failed to load model: {e}")
            self._unload()
            return False

    def _unload(self) -> None:
        """Unload current model and free memory"""
        if self._model is not None:
            del self._model
            self._model = None
        
        if self._index is not None:
            del self._index
            self._index = None
        
        if self._hubert is not None:
            del self._hubert
            self._hubert = None
        
        if self._pitch_extractor is not None:
            del self._pitch_extractor
            self._pitch_extractor = None
        
        if self._vocoder is not None:
            del self._vocoder
            self._vocoder = None
        
        if TORCH_AVAILABLE:
            try:
                import torch
                if DEVICE == "cuda":
                    torch.cuda.empty_cache()
                elif DEVICE == "mps":
                    torch.mps.empty_cache()
            except Exception:
                pass
        
        self._loaded_id = None
        print("[model] Model unloaded")
    
    def infer(self, audio: 'np.ndarray', pitch_shift: int = 0, index_ratio: float = 0.75) -> 'np.ndarray':
        """
        Perform voice conversion inference.
        
        Args:
            audio: Input audio array
            pitch_shift: Semitones to shift pitch
            index_ratio: Feature matching ratio (0-1)
            
        Returns:
            Converted audio array
        """
        if self._model is None:
            return audio
        
        # TODO: Implement full RVC inference pipeline
        # 1. Extract pitch
        # 2. Extract HuBERT features
        # 3. Match features using FAISS index
        # 4. Apply voice conversion
        # 5. Synthesize with vocoder
        
        return audio

    @property
    def loaded_id(self) -> Optional[str]:
        return self._loaded_id
    
    @property
    def is_loaded(self) -> bool:
        return self._model is not None


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
