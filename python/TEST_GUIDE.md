# VoxShift Testing Guide

## Prerequisites

1. **Python 3.10+** installed
2. **Virtual environment** (recommended)

## Setup

### 1. Install Dependencies

```bash
cd Voxshift/python
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 2. Install PyTorch with GPU Support (Optional but Recommended)

For CUDA (NVIDIA GPUs):
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

For ROCm (AMD GPUs):
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/rocm5.7
```

For Apple Silicon (M1/M2/M3):
```bash
pip install torch torchaudio
```

## Running Tests

### Option 1: Automated Test Runner (Recommended)

This starts the server automatically and runs all tests:

```bash
python run_tests.py
```

### Option 2: Manual Testing

Start the server in one terminal:
```bash
python main.py --port 8765
```

Run tests in another terminal:
```bash
python test_api.py
```

### Option 3: Using pytest

```bash
pytest test_api.py -v
```

## Test Coverage

The test suite covers:

### ✓ Synchronous Tests
- Audio device listing
- AudioEngine initialization and settings
- Hardware detection (CPU/CUDA/MPS)
- ModelLoader initialization

### ✓ Asynchronous Tests (requires server)
- Health check endpoint
- Device listing API
- Model CRUD operations
- Settings management
- Audio engine start/stop
- Marketplace integration
- Cache management
- Database operations

## Expected Results

### With Audio Devices
```
✓ Audio devices: X inputs, Y outputs
✓ AudioEngine initialized
✓ AudioEngine settings updated
✓ Hardware detected: cuda/cpu/mps
✓ ModelLoader initialized
```

### Without Audio Devices
```
✓ Audio devices: 0 inputs, 0 outputs
⚠ Audio engine failed to start (may need audio devices)
```

## Troubleshooting

### Server Won't Start

1. **Check if port 8765 is already in use:**
   ```bash
   # Windows
   netstat -ano | findstr :8765
   
   # macOS/Linux
   lsof -i :8765
   ```

2. **Try a different port:**
   ```bash
   python main.py --port 8766
   ```
   
   Then update `API_BASE` in `test_api.py` to `http://localhost:8766`

### Missing Dependencies

If you get import errors:
```bash
pip install -r requirements.txt --upgrade
```

### Audio Device Issues

If no audio devices are detected:
- **Windows**: Check if audio drivers are installed
- **macOS**: Grant microphone permissions in System Preferences
- **Linux**: Install `portaudio19-dev` and `python3-pyaudio`

### Database Errors

If you get SQLite errors:
```bash
# Delete the database and let it recreate
rm ~/.voxshift/voxshift.db
```

## Manual API Testing

You can also test endpoints manually using curl or httpx:

```bash
# Health check
curl http://localhost:8765/health

# List devices
curl http://localhost:8765/api/devices

# Get settings
curl http://localhost:8765/api/settings

# Update settings
curl -X PUT http://localhost:8765/api/settings \
  -H "Content-Type: application/json" \
  -d '{"pitch_shift": 5}'
```

## Performance Testing

To test audio latency and throughput:

1. Start the server with a model loaded
2. Start audio processing
3. Monitor the waveform WebSocket for frame timing
4. Expected latency: <200ms on GPU, <500ms on CPU

## Integration Testing

To test the full Electron + Python stack:

1. Start the Python backend:
   ```bash
   cd python
   python main.py --port 8765
   ```

2. Start the Electron app:
   ```bash
   cd ..
   npm run dev
   ```

3. Test in the UI:
   - Select input/output devices
   - Choose a voice model
   - Click "Start"
   - Speak into your microphone
   - Verify waveform display updates
   - Check output audio

## CI/CD Integration

For automated testing in CI pipelines:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: |
          cd Voxshift/python
          pip install -r requirements.txt
          python test_api.py
```

## Next Steps

After tests pass:

1. ✓ Verify audio input/output works
2. ✓ Test model loading and inference
3. ✓ Test training pipeline
4. ✓ Test marketplace downloads
5. ✓ Test WebSocket real-time updates
6. ✓ Performance profiling
7. ✓ Memory leak testing
8. ✓ Cross-platform testing

## Support

If tests fail or you encounter issues:

1. Check the console output for error messages
2. Review the logs in the terminal
3. Ensure all dependencies are installed
4. Verify Python version is 3.10+
5. Check that no other process is using port 8765

For more help, see the main README.md or open an issue on GitHub.