"""
VoxShift audio engine — real-time voice conversion.

Uses the WORLD vocoder (pyworld) for high-quality pitch/timbre
manipulation that properly separates pitch from spectral envelope.
This gives dramatically better results than simple resampling or
phase-vocoder pitch shifting.
"""
from __future__ import annotations
import threading
import time
import numpy as np
from typing import Optional, Callable
from collections import deque

try:
    import sounddevice as sd
    SD_AVAILABLE = True
except Exception:
    SD_AVAILABLE = False

try:
    import pyworld as pw
    PYWORLD_AVAILABLE = True
except Exception:
    PYWORLD_AVAILABLE = False

try:
    from scipy.signal import resample_poly
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


# ── WORLD vocoder voice converter ────────────────────────────────────────────

class WorldVoiceConverter:
    """
    Real-time voice conversion using the WORLD vocoder.

    WORLD decomposes audio into three components:
      - F0 (fundamental frequency / pitch)
      - Spectral envelope (timbre / voice character)
      - Aperiodicity (breathiness / noise)

    By modifying F0 and the spectral envelope independently,
    we can change pitch without chipmunk effects and alter
    voice timbre to sound like a different person.
    """

    def __init__(self, sr: int = 48000) -> None:
        self.sr = sr
        # Accumulation buffer for WORLD (needs ~50ms+ of audio)
        self._buf = np.zeros(0, dtype=np.float64)
        self._min_samples = int(sr * 0.06)  # 60ms minimum for analysis

    def process(
        self,
        audio: np.ndarray,
        pitch_shift: float = 0,
        formant_shift: float = 0,
    ) -> np.ndarray:
        """
        Convert voice using WORLD vocoder analysis/synthesis.

        pitch_shift:  semitones (-24 to +24)
        formant_shift: semitones (-24 to +24) — shifts spectral envelope
        """
        if not PYWORLD_AVAILABLE:
            return audio

        orig_len = len(audio)

        # Accumulate audio for WORLD (needs longer frames than typical buffers)
        self._buf = np.concatenate([self._buf, audio.astype(np.float64)])

        if len(self._buf) < self._min_samples:
            return audio  # not enough data yet, pass through

        # Take what we have and process
        work = self._buf.copy()
        self._buf = np.zeros(0, dtype=np.float64)

        try:
            # ── WORLD analysis ───────────────────────────────────────
            # DIO: fast pitch extraction
            f0, t = pw.dio(work, self.sr, frame_period=5.0)
            f0 = pw.stonemask(work, f0, t, self.sr)  # refine pitch

            # CheapTrick: spectral envelope extraction
            sp = pw.cheaptrick(work, f0, t, self.sr)

            # D4C: aperiodicity extraction
            ap = pw.d4c(work, f0, t, self.sr)

            # ── Pitch modification ───────────────────────────────────
            if pitch_shift != 0:
                ratio = 2.0 ** (pitch_shift / 12.0)
                f0_modified = f0.copy()
                voiced = f0_modified > 0
                f0_modified[voiced] *= ratio
                # Clamp to reasonable range
                f0_modified = np.clip(f0_modified, 0, 1200)
            else:
                f0_modified = f0

            # ── Formant / timbre modification ────────────────────────
            if formant_shift != 0:
                shift_ratio = 2.0 ** (formant_shift / 12.0)
                sp_modified = _shift_spectral_envelope(sp, shift_ratio)
            else:
                sp_modified = sp

            # ── WORLD synthesis ──────────────────────────────────────
            result = pw.synthesize(f0_modified, sp_modified, ap, self.sr, frame_period=5.0)
            result = result.astype(np.float32)

            # Match output length to input length
            if len(result) >= orig_len:
                return result[:orig_len]
            else:
                out = np.zeros(orig_len, dtype=np.float32)
                out[:len(result)] = result
                return out

        except Exception as e:
            # On any error, pass through original audio
            return audio[:orig_len].astype(np.float32)

    def reset(self) -> None:
        self._buf = np.zeros(0, dtype=np.float64)


def _shift_spectral_envelope(sp: np.ndarray, ratio: float) -> np.ndarray:
    """
    Shift the spectral envelope to change voice timbre/formants.

    ratio > 1: shift formants up (sounds more feminine / younger)
    ratio < 1: shift formants down (sounds more masculine / deeper)
    """
    n_frames, n_freq = sp.shape
    sp_shifted = np.zeros_like(sp)

    for i in range(n_frames):
        for j in range(n_freq):
            src_bin = int(j / ratio)
            if 0 <= src_bin < n_freq:
                sp_shifted[i, j] = sp[i, src_bin]
            else:
                sp_shifted[i, j] = sp[i, -1]  # repeat last bin

    return sp_shifted


# ── Audio engine ─────────────────────────────────────────────────────────────

class AudioEngine:
    def __init__(self) -> None:
        self._running = False
        self._thread: Optional[threading.Thread] = None
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
        self._converter: Optional[WorldVoiceConverter] = None

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

        # Standard 48kHz sample rate
        sr = 48000

        # Use large buffer for WORLD processing (needs 50ms+ chunks)
        # Override small buffers — WORLD can't work on 256 samples
        effective_buf = max(buf_size, 2048)

        # Create WORLD voice converter
        self._converter = WorldVoiceConverter(sr=sr)

        monitor_queue: list[np.ndarray] = []

        def callback(indata: np.ndarray, outdata: np.ndarray, frames: int, time_info, status) -> None:
            audio = indata[:, 0].copy() * input_gain

            # Amplitude envelope for waveform display (32 bands)
            n_bands = min(32, max(1, len(audio)))
            bands = np.array_split(np.abs(audio), n_bands)
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
                    blocksize=effective_buf,
                    dtype="float32",
                    channels=1,
                    callback=monitor_callback
                )

            with sd.Stream(
                device=(in_dev, out_dev),
                samplerate=sr,
                blocksize=effective_buf,
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
        Process audio through WORLD vocoder voice conversion.
        """
        # ── Noise gate ───────────────────────────────────────────────
        if self._settings.get("noise_suppression", True):
            threshold = 0.005
            envelope = np.abs(audio)
            gate = np.where(envelope > threshold, 1.0, envelope / (threshold + 1e-8))
            audio = (audio * gate).astype(np.float32)

        # ── WORLD voice conversion ───────────────────────────────────
        pitch_shift = self._settings.get("pitch_shift", 0)
        formant_shift = self._settings.get("formant_shift", 0)

        if (pitch_shift != 0 or formant_shift != 0) and self._converter is not None:
            try:
                audio = self._converter.process(
                    audio,
                    pitch_shift=float(pitch_shift),
                    formant_shift=float(formant_shift),
                )
            except Exception:
                pass

        return audio

    @property
    def is_running(self) -> bool:
        return self._running
