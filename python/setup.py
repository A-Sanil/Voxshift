"""
Dev helper: checks that the Python environment is set up correctly.
Run with: python setup.py
"""
import sys
import importlib

REQUIRED = [
    ("fastapi", "FastAPI"),
    ("uvicorn", "uvicorn"),
    ("aiosqlite", "aiosqlite"),
    ("pydantic", "Pydantic"),
    ("numpy", "NumPy"),
]

OPTIONAL = [
    ("sounddevice", "sounddevice (audio I/O)"),
    ("torch", "PyTorch (inference)"),
    ("scipy", "SciPy"),
    ("librosa", "librosa"),
]


def check(packages, label):
    print(f"\n{label}:")
    for module, name in packages:
        try:
            mod = importlib.import_module(module)
            ver = getattr(mod, "__version__", "?")
            print(f"  ✓ {name} ({ver})")
        except ImportError:
            print(f"  ✗ {name} — NOT INSTALLED")


check(REQUIRED, "Required packages")
check(OPTIONAL, "Optional packages")

try:
    import torch
    device = (
        "CUDA " + torch.cuda.get_device_name(0) if torch.cuda.is_available()
        else "MPS" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        else "CPU (no GPU acceleration)"
    )
    print(f"\nHardware: {device}")
except ImportError:
    print("\nHardware: PyTorch not installed — CPU fallback will be used")

print(f"\nPython {sys.version}")
print("\nRun `python main.py` to start the sidecar on port 8765.")
