from __future__ import annotations
import threading
import time
import numpy as np
from typing import Optional, Callable, TYPE_CHECKING
from collections import deque

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


# ── Phase vocoder pitch shifter ──────────────────────────────────────────────

class PitchShifter:
    """
    Real-time phase-vocoder pitch shifter using overlap-add.
    Much cleaner than resampling — no chipmunk/rasping artifacts.
    """

    def __init__(self, fft_size: int = 2048, hop_size: int = 512) -> None:
        self.fft_size = fft_size
        self.hop_size = hop_size
        self.window = np.hanning(fft_size).astype(np.float32)
        self._in_buf = np.zeros(fft_size, dtype=np.float32)
        self._out_buf = np.zeros(fft_size * 2, dtype=np.float32)
        self._out_pos = 0
        self._prev_phase = np.zeros(fft_size // 2 + 1, dtype=np.float64)
        self._sum_phase = np.zeros(fft_size // 2 + 1, dtype=np.float64)
        self._expected_phase_diff = 2.0 * np.pi * hop_size / fft_size * np.arange(fft_size // 2 + 1)

    def process(self, audio: np.ndarray, semitones: float) -> np.ndarray:
        """Pitch-shift a buffer of audio by the given number of semitones."""
        if semitones == 0:
            return audio

        shift_ratio = 2.0 ** (semitones / 12.0)
        output = np.zeros(len(audio), dtype=np.float32)
        pos = 0

        while pos + self.fft_size <= len(audio) + self.fft_size:
            # Fill input buffer
            chunk_start = pos - self.fft_size + self.hop_size
            if chunk_start < 0:
                frame = np.zeros(self.fft_size, dtype=np.float32)
                valid_start = max(0, chunk_start + self.fft_size - self.hop_size)
                copy_len = min(len(audio) - max(0, chunk_start), self.fft_size)
                src_start = max(0, chunk_start)
                if src_start < len(audio) and copy_len > 0:
                    actual = min(copy_len, len(audio) - src_start, self.fft_size)
                    frame[self.fft_size - actual:] = audio[src_start:src_start + actual]
            else:
                end = min(chunk_start + self.fft_size, len(audio))
                if end - chunk_start < self.fft_size:
                    frame = np.zeros(self.fft_size, dtype=np.float32)
                    frame[:end - chunk_start] = audio[chunk_start:end]
                else:
                    frame = audio[chunk_start:end].copy()

            # Window and FFT
            windowed = frame * self.window
            spectrum = np.fft.rfft(windowed)
            magnitude = np.abs(spectrum)
            phase = np.angle(spectrum)

            # Phase difference
            phase_diff = phase - self._prev_phase
            self._prev_phase = phase.copy()

            # Subtract expected phase advance
            phase_diff -= self._expected_phase_diff
            # Wrap to [-pi, pi]
            phase_diff = phase_diff - 2.0 * np.pi * np.round(phase_diff / (2.0 * np.pi))
            # True frequency deviation
            true_freq = self._expected_phase_diff + phase_diff

            # Accumulate phase at new pitch
            self._sum_phase += true_freq * shift_ratio

            # Pitch-shift by moving frequency bins
            n_bins = len(magnitude)
            new_magnitude = np.zeros(n_bins, dtype=np.float64)
            new_phase = np.zeros(n_bins, dtype=np.float64)

            for k in range(n_bins):
                new_bin = int(round(k * shift_ratio))
                if 0 <= new_bin < n_bins:
                    new_magnitude[new_bin] += magnitude[k]
                    new_phase[new_bin] = self._sum_phase[k]

            # Resynthesize
            new_spectrum = new_magnitude * np.exp(1j * new_phase)
            resynthesized = np.fft.irfft(new_spectrum, n=self.fft_size).astype(np.float32)
            resynthesized *= self.window

            # Overlap-add into output buffer
            out_start = pos
            out_end = min(pos + self.fft_size, len(output))
            add_len = out_end - out_start
            if add_len > 0:
                output[out_start:out_end] += resynthesized[:add_len]

            pos += self.hop_size
            if pos >= len(audio):
                break

        # Normalize by overlap factor
        overlap_factor = self.fft_size / self.hop_size
        if overlap_factor > 0:
            output /= (overlap_factor * 0.5)

        return output

    def reset(self) -> None:
        self._prev_phase[:] = 0
        self._sum_phase[:] = 0


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
        self._pitch_shifter: Optional[PitchShifter] = None

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

        # Use standard 48kHz sample rate
        sr = 48000

        # Create pitch shifter sized for this buffer
        fft_size = max(2048, buf_size * 4)
        self._pitch_shifter = PitchShifter(fft_size=fft_size, hop_size=buf_size)

        # Accumulate input for processing (need at least fft_size samples)
        input_ring = deque(maxlen=fft_size)
        for _ in range(fft_size):
            input_ring.append(0.0)

        monitor_queue: list[np.ndarray] = []

        def callback(indata: np.ndarray, outdata: np.ndarray, frames: int, time_info, status) -> None:
            audio = indata[:, 0].copy() * input_gain

            # Amplitude envelope for waveform display (32 bands)
            bands = np.array_split(np.abs(audio), min(32, len(audio)))
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
        Process audio through voice effects.
        Uses a phase vocoder for clean pitch shifting.
        """
        # ── Noise gate (smooth envelope follower) ────────────────────────
        if self._settings.get("noise_suppression", True):
            threshold = 0.005
            envelope = np.abs(audio)
            gate = np.where(envelope > threshold, 1.0, envelope / (threshold + 1e-8))
            audio = (audio * gate).astype(np.float32)

        # ── Phase-vocoder pitch shift ────────────────────────────────────
        pitch_shift = self._settings.get("pitch_shift", 0)
        if pitch_shift != 0 and self._pitch_shifter is not None:
            try:
                audio = self._pitch_shifter.process(audio, float(pitch_shift))
            except Exception:
                pass

        # ── Formant shift (spectral tilt) ────────────────────────────────
        formant_shift = self._settings.get("formant_shift", 0)
        if formant_shift != 0:
            try:
                alpha = np.clip(formant_shift * 0.015, -0.95, 0.95)
                out = np.empty_like(audio)
                out[0] = audio[0]
                out[1:] = audio[1:] - alpha * audio[:-1]
                audio = out
            except Exception:
                pass

        # ── RVC model inference (when available) ─────────────────────────
        # TODO: Integrate actual RVC inference here

        return audio

    @property
    def is_running(self) -> bool:
        return self._running
