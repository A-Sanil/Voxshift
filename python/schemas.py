from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid


ModelSource = Literal["marketplace", "local_import", "trained"]
AudioStatus = Literal["idle", "starting", "live", "stopping", "error"]
TrainingStatus = Literal["running", "completed", "failed", "cancelled"]


class VoiceModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    source_type: ModelSource = "local_import"
    file_path: str
    index_path: Optional[str] = None
    avatar: str = "🎤"
    category: str = "Custom"
    added_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class CreateModelRequest(BaseModel):
    name: str
    file_path: str
    source_type: ModelSource = "local_import"
    index_path: Optional[str] = None
    avatar: str = "🎤"
    category: str = "Custom"


class AppSettingsPatch(BaseModel):
    active_model_id: Optional[str] = None
    input_device: Optional[int] = None
    output_device: Optional[int] = None
    monitor_device: Optional[int] = None
    noise_suppression: Optional[bool] = None
    monitor_enabled: Optional[bool] = None
    pitch_shift: Optional[float] = None
    formant_shift: Optional[float] = None
    index_ratio: Optional[float] = None
    buffer_size: Optional[int] = None
    input_gain: Optional[float] = None
    output_gain: Optional[float] = None
    pitch_algo: Optional[str] = None
    gpu_acceleration: Optional[bool] = None
    launch_at_startup: Optional[bool] = None
    start_minimized: Optional[bool] = None
    auto_update: Optional[bool] = None


class AppSettings(BaseModel):
    active_model_id: Optional[str] = None
    input_device: Optional[int] = None
    output_device: Optional[int] = None
    monitor_device: Optional[int] = None
    noise_suppression: bool = True
    monitor_enabled: bool = False
    pitch_shift: float = 0.0
    formant_shift: float = 0.0
    index_ratio: float = 0.75
    buffer_size: int = 512
    input_gain: float = 100.0
    output_gain: float = 0.0
    pitch_algo: str = "rmvpe"
    gpu_acceleration: bool = True
    launch_at_startup: bool = False
    start_minimized: bool = False
    auto_update: bool = True


class AudioDevice(BaseModel):
    index: int
    name: str
    channels: int
    default_sr: int


class DevicesResponse(BaseModel):
    input: list[AudioDevice]
    output: list[AudioDevice]


class TrainRequest(BaseModel):
    model_name: str
    file_paths: list[str]
    total_epochs: int = Field(default=100, ge=1, le=1000)
    sample_rate: int = Field(default=40000)


class TrainingJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    model_name: str
    total_epochs: int
    current_epoch: int = 0
    status: TrainingStatus = "running"
    started_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# WebSocket event shapes
class WaveformEvent(BaseModel):
    type: Literal["waveform"] = "waveform"
    amplitudes: list[float]


class AudioStatusEvent(BaseModel):
    type: Literal["audio_status"] = "audio_status"
    status: AudioStatus
    message: Optional[str] = None


class TrainingProgressEvent(BaseModel):
    type: Literal["training_progress"] = "training_progress"
    job_id: str
    epoch: int
    total: int
    loss: float
    status: TrainingStatus
