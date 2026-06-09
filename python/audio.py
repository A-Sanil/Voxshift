from __future__ import annotations
import asyncio
import threading
import time
import numpy as np
from typing import Optional, Callable, TYPE_CHECKING

if TYPE_CHECKING:
    pass

try:
    import sounddevice as sd
    SD_AVAILABLE = True
except Exception:
    SD_AVAILABLE = False

try:
    import torch
    TORCH_AVAILABLE = True
except Exception:
    TORCH_AVAILABLE = False

try:
    from scipy.signal import resample, lfilter, firwin
    SCIPY_AVAILABLE = True
except Exception:
    SCIPY_AVAILABLE = False


def list_input_devices() -> list[dict]:
    if not SD_AVAILABLE:
        return []
    devices = []
    try:
        for i, d in enumerate(sd.query_devices()):
            if d["max_input_channels"] > 0:
                devices.append({
                    "index": i,
                    "name": d["name"],
                    "channels": d["max_input_channels"],
                    "default_sr": int(d["default_samplerate"])
                })
    except Exception:
        pass
    return devices


def list_output_devices() -> list[dict]:
    if not SD_AVAILABLE:
        return []
    devices = []
    try:
        for i, d in enumerate(sd.query_devices()):
            if d["max_output_channels"] > 0:
                devices.append({
                    "index": i,
                    "name": d["name"],
                    "channels": d["max_output_channels"],
                    "default_sr": int(d["default_samplerate"])
                })
    except Exception:
        pass
    return devices


class AudioEngine:
    def __init__(self) -> None:
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._monitor_thread: Optional[threading.Thread] = None
        self._amplitude_cb: Optional[Callable[[list[float]], None]] = None
        self._settings: dict = {
            "input_device": None,
            "output_device": None,
            "monitor_device": None,
            "buffer_size": 512,
            "pitch_shift": 0,
            "formant_shift": 0,
            "index_ratio": 0.75,
            "noise_suppression": True,
            "monitor_enabled": False,
            "input_gain": 100.0,
            "output_gain": 0.0,
        }
        self._model = None
        # Pre-compute anti-alias filter for pitch shifting
        self._aa_filter: Optional[np.ndarray] = None

    def set_settings(self, patch: dict) -> None:
        self._settings.update({k: v for k, v in patch.items() if v is not None})

    def set_model(self, model) -> None:
        self._model = model

    def set_amplitude_callback(self, cb: Callable[[list[float]], None]) -> None:
        self._amplitude_cb = cb

    def start(self) -> bool:
        if self._running:
            return True
        if not SD_AVAILABLE:
            return False
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        return True

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None

    def _run_loop(self) -> None:
        buf_size = self._settings.get("buffer_size", 512)
        in_dev = self._settings.get("input_device")
        out_dev = self._settings.get("output_device")
        mon_dev = self._settings.get("monitor_device")
        monitor_enabled = self._settings.get("monitor_enabled", False)
        input_gain = self._settings.get("input_gain", 100.0) / 100.0
        output_gain_db = self._settings.get("output_gain", 0.0)
        output_gain_linear = 10 ** (output_gain_db / 20.0)

        # Use device native sample rate (48000 is standard for most devices)
        sr = 48000

        # Build anti-alias low-pass filter (cuts at Nyquist/2 to reduce artifacts)
        if SCIPY_AVAILABLE:
            try:
                self._aa_filter = firwin(63, 0.45).astype(np.float32)
            except Exception:
                self._aa_filter = None

        # Optional monitor stream (hear yourself)
        monitor_queue: list[np.ndarray] = []

        def callback(indata: np.ndarray, outdata: np.ndarray, frames: int, time_info, status) -> None:
            audio = indata[:, 0].copy() * input_gain

            # Amplitude envelope for waveform display (32 bands)
            bands = np.array_split(np.abs(audio), 32)
            amplitudes = [float(np.mean(b)) * 4.0 for b in bands]
            if self._amplitude_cb:
                self._amplitude_cb(amplitudes)

            processed = self._process(audio) * output_gain_linear

            # Soft-clip to prevent digital distortion
            processed = np.tanh(processed).astype(np.float32)

            outdata[:] = processed.reshape(-1, 1)

            if monitor_enabled:
                monitor_queue.append(processed.copy())

        def monitor_callback(outdata: np.ndarray, frames: int, time_info, status) -> None:
            if monitor_queue:
                chunk = monitor_queue.pop(0)
                n = min(len(chunk), frames)
                outdata[:n] = chunk[:n].reshape(-1, 1)
                if n < frames:
                    outdata[n:] = 0
            else:
                outdata[:] = 0

        try:
            # If monitor enabled but no dedicated device, fall back to output device
            if monitor_enabled and mon_dev is None:
                mon_dev = out_dev

            monitor_stream = None
            if monitor_enabled and mon_dev is not None:
                monitor_stream = sd.OutputStream(
                    device=mon_dev,
                    samplerate=sr,
                    blocksize=buf_size,
                    dtype="float32",
                    channels=1,
                    callback=monitor_callback
                )

            with sd.Stream(
                device=(in_dev, out_dev),
                samplerate=sr,
                blocksize=buf_size,
                dtype="float32",
                channels=1,
                callback=callback
            ):
                if monitor_stream:
                    monitor_stream.start()
                while self._running:
                    time.sleep(0.05)
                if monitor_stream:
                    monitor_stream.stop()
                    monitor_stream.close()
        except Exception as e:
            print(f"[audio] Stream error: {e}")
        finally:
            self._running = False

    def _process(self, audio: np.ndarray) -> np.ndarray:
        """
        Process audio through voice effects and (eventually) RVC model.
        Pitch shift, formant shift, and noise gate always apply.
        """
        # ── Noise gate (before everything else) ──────────────────────────
        if self._settings.get("noise_suppression", True):
            threshold = 0.005  # -46dB — gentler gate
            envelope = np.abs(audio)
            gate = np.where(envelope > threshold, 1.0, envelope / (threshold + 1e-8))
            audio = (audio * gate).astype(np.float32)

        # ── Pitch shift (always active) ──────────────────────────────────
        pitch_shift = self._settings.get("pitch_shift", 0)
        if pitch_shift != 0:
            factor = 2 ** (pitch_shift / 12.0)
            if factor != 1.0:
                try:
                    orig_len = len(audio)

                    if SCIPY_AVAILABLE:
                        # scipy.signal.resample — proper band-limited resampling
                        new_length = max(2, int(orig_len / factor))
                        resampled = resample(audio, new_length).astype(np.float32)
                    else:
                        # Fallback: numpy interp with anti-alias
                        new_length = max(2, int(orig_len / factor))
                        x = np.linspace(0, orig_len - 1, orig_len)
                        x_new = np.linspace(0, orig_len - 1, new_length)
                        resampled = np.interp(x_new, x, audio).astype(np.float32)

                    # Anti-alias filter to reduce artifacts
                    if self._aa_filter is not None and len(resampled) > len(self._aa_filter):
                        try:
                            resampled = np.convolve(resampled, self._aa_filter, mode='same').astype(np.float32)
                        except Exception:
                            pass

                    # Fit back to original buffer length
                    if len(resampled) < orig_len:
                        audio = np.pad(resampled, (0, orig_len - len(resampled)))
                    else:
                        audio = resampled[:orig_len]
                except Exception:
                    pass

        # ── Formant shift (spectral tilt via pre-emphasis filter) ────────
        formant_shift = self._settings.get("formant_shift", 0)
        if formant_shift != 0:
            try:
                alpha = np.clip(formant_shift * 0.015, -0.95, 0.95)
                if SCIPY_AVAILABLE:
                    audio = lfilter([1, -alpha], [1], audio).astype(np.float32)
                else:
                    # Manual pre-emphasis
                    out = np.empty_like(audio)
                    out[0] = audio[0]
                    for i in range(1, len(audio)):
                        out[i] = audio[i] - alpha * audio[i - 1]
                    audio = out
            except Exception:
                pass

        # ── RVC model inference (when available) ─────────────────────────
        # TODO: Integrate actual RVC inference here

        return audio

    @property
    def is_running(self) -> bool:
        return self._running
