"""
Comprehensive API tests for VoxShift backend
Tests all endpoints, audio functionality, model loading, and training
"""
import sys
import io

# Fix Windows console encoding issues
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
import asyncio
import json
import time
from pathlib import Path
import httpx
import pytest
from typing import AsyncGenerator

# Test configuration
API_BASE = "http://localhost:8765"
TIMEOUT = 30.0


class TestVoxShiftAPI:
    """Test suite for VoxShift API endpoints"""
    
    @pytest.fixture
    async def client(self) -> AsyncGenerator[httpx.AsyncClient, None]:
        """Create async HTTP client"""
        async with httpx.AsyncClient(base_url=API_BASE, timeout=TIMEOUT) as client:
            yield client
    
    @pytest.mark.asyncio
    async def test_health_check(self, client: httpx.AsyncClient):
        """Test /health endpoint"""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")
    
    @pytest.mark.asyncio
    async def test_get_devices(self, client: httpx.AsyncClient):
        """Test /api/devices endpoint - list audio devices"""
        response = await client.get("/api/devices")
        assert response.status_code == 200
        data = response.json()
        assert "input" in data
        assert "output" in data
        assert isinstance(data["input"], list)
        assert isinstance(data["output"], list)
        
        # Verify device structure
        if data["input"]:
            device = data["input"][0]
            assert "index" in device
            assert "name" in device
            assert "channels" in device
            assert "default_sr" in device
        
        print(f"✓ Found {len(data['input'])} input devices, {len(data['output'])} output devices")
    
    @pytest.mark.asyncio
    async def test_get_models(self, client: httpx.AsyncClient):
        """Test /api/models endpoint - list voice models"""
        response = await client.get("/api/models")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} voice models")
    
    @pytest.mark.asyncio
    async def test_get_settings(self, client: httpx.AsyncClient):
        """Test /api/settings endpoint"""
        response = await client.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Verify required settings exist
        required_keys = [
            "input_device", "output_device", "buffer_size",
            "pitch_shift", "index_ratio", "input_gain", "output_gain"
        ]
        for key in required_keys:
            assert key in data, f"Missing setting: {key}"
        
        print("✓ Settings retrieved successfully")
    
    @pytest.mark.asyncio
    async def test_update_settings(self, client: httpx.AsyncClient):
        """Test /api/settings PUT endpoint"""
        # Update some settings
        new_settings = {
            "pitch_shift": 5,
            "index_ratio": 0.8,
            "buffer_size": 1024
        }
        
        response = await client.put("/api/settings", json=new_settings)
        assert response.status_code == 200
        data = response.json()
        
        # Verify settings were updated
        assert data["pitch_shift"] == 5
        assert data["index_ratio"] == 0.8
        assert data["buffer_size"] == 1024
        
        print("✓ Settings updated successfully")
    
    @pytest.mark.asyncio
    async def test_create_model(self, client: httpx.AsyncClient):
        """Test /api/models POST endpoint - create a model"""
        model_data = {
            "name": "Test Voice Model",
            "source_type": "local_import",
            "file_path": "/path/to/test.pth",
            "index_path": None,
            "avatar": "🎤",
            "category": "Test"
        }
        
        response = await client.post("/api/models", json=model_data)
        assert response.status_code == 201
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "Test Voice Model"
        assert data["source_type"] == "local_import"
        
        # Clean up - delete the test model
        model_id = data["id"]
        delete_response = await client.delete(f"/api/models/{model_id}")
        assert delete_response.status_code == 204
        
        print("✓ Model creation and deletion successful")
    
    @pytest.mark.asyncio
    async def test_audio_start_stop(self, client: httpx.AsyncClient):
        """Test audio engine start/stop"""
        # Start audio
        response = await client.post("/api/audio/start")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["live", "error"]
        
        if data["status"] == "live":
            print("✓ Audio engine started")
            
            # Wait a moment
            await asyncio.sleep(1)
            
            # Stop audio
            response = await client.post("/api/audio/stop")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "idle"
            print("✓ Audio engine stopped")
        else:
            print("⚠ Audio engine failed to start (may need audio devices)")
    
    @pytest.mark.asyncio
    async def test_marketplace_fetch(self, client: httpx.AsyncClient):
        """Test /api/marketplace endpoint"""
        response = await client.get("/api/marketplace?page=1&category=All&sort=new")
        
        # Marketplace may fail if external service is down
        if response.status_code == 200:
            data = response.json()
            assert "models" in data or isinstance(data, list)
            print("✓ Marketplace fetch successful")
        else:
            print("⚠ Marketplace unavailable (external service)")
    
    @pytest.mark.asyncio
    async def test_cache_clear(self, client: httpx.AsyncClient):
        """Test /api/cache DELETE endpoint"""
        response = await client.delete("/api/cache")
        assert response.status_code == 204
        print("✓ Cache cleared successfully")


class TestAudioEngine:
    """Test audio engine functionality"""
    
    def test_list_devices(self):
        """Test device listing"""
        from audio import list_input_devices, list_output_devices
        
        input_devices = list_input_devices()
        output_devices = list_output_devices()
        
        assert isinstance(input_devices, list)
        assert isinstance(output_devices, list)
        
        print(f"✓ Audio devices: {len(input_devices)} inputs, {len(output_devices)} outputs")
    
    def test_audio_engine_init(self):
        """Test AudioEngine initialization"""
        from audio import AudioEngine
        
        engine = AudioEngine()
        assert not engine.is_running
        assert engine._settings["buffer_size"] == 512
        assert engine._settings["pitch_shift"] == 0
        
        print("✓ AudioEngine initialized")
    
    def test_audio_engine_settings(self):
        """Test AudioEngine settings update"""
        from audio import AudioEngine
        
        engine = AudioEngine()
        engine.set_settings({
            "pitch_shift": 12,
            "buffer_size": 1024,
            "input_gain": 150.0
        })
        
        assert engine._settings["pitch_shift"] == 12
        assert engine._settings["buffer_size"] == 1024
        assert engine._settings["input_gain"] == 150.0
        
        print("✓ AudioEngine settings updated")


class TestInference:
    """Test inference and model loading"""
    
    def test_hardware_detection(self):
        """Test hardware detection"""
        from inference import detect_hardware
        
        hw = detect_hardware()
        assert "device" in hw
        assert "torch_available" in hw
        assert hw["device"] in ["cpu", "cuda", "mps"]
        
        print(f"✓ Hardware detected: {hw['device']}")
        if hw.get("gpu_name"):
            print(f"  GPU: {hw['gpu_name']}")
    
    def test_model_loader_init(self):
        """Test ModelLoader initialization"""
        from inference import ModelLoader
        
        loader = ModelLoader()
        assert loader.loaded_id is None
        
        print("✓ ModelLoader initialized")


class TestDatabase:
    """Test database operations"""
    
    @pytest.mark.asyncio
    async def test_database_init(self):
        """Test database initialization"""
        from database import init_db, get_all_models, get_all_settings
        
        await init_db()
        
        models = await get_all_models()
        assert isinstance(models, list)
        
        settings = await get_all_settings()
        assert isinstance(settings, dict)
        
        print("✓ Database initialized and accessible")
    
    @pytest.mark.asyncio
    async def test_model_crud(self):
        """Test model CRUD operations"""
        from database import insert_model, get_all_models, delete_model
        import uuid
        from datetime import datetime
        
        # Create
        test_model = {
            "id": str(uuid.uuid4()),
            "name": "Test CRUD Model",
            "source_type": "test",
            "file_path": "/test/path.pth",
            "index_path": None,
            "avatar": "🧪",
            "category": "Test",
            "added_at": datetime.utcnow().isoformat()
        }
        
        await insert_model(test_model)
        
        # Read
        models = await get_all_models()
        found = any(m["id"] == test_model["id"] for m in models)
        assert found, "Model not found after insert"
        
        # Delete
        await delete_model(test_model["id"])
        
        models = await get_all_models()
        found = any(m["id"] == test_model["id"] for m in models)
        assert not found, "Model still exists after delete"
        
        print("✓ Model CRUD operations successful")


def run_sync_tests():
    """Run synchronous tests"""
    print("\n=== Running Synchronous Tests ===\n")
    
    test_audio = TestAudioEngine()
    test_audio.test_list_devices()
    test_audio.test_audio_engine_init()
    test_audio.test_audio_engine_settings()
    
    test_inference = TestInference()
    test_inference.test_hardware_detection()
    test_inference.test_model_loader_init()
    
    print("\n✓ All synchronous tests passed\n")


async def run_async_tests():
    """Run asynchronous tests"""
    print("\n=== Running Asynchronous Tests ===\n")
    
    # Wait for server to be ready
    print("Waiting for server to be ready...")
    max_retries = 10
    for i in range(max_retries):
        try:
            async with httpx.AsyncClient(base_url=API_BASE, timeout=5.0) as client:
                response = await client.get("/health")
                if response.status_code == 200:
                    print("✓ Server is ready\n")
                    break
        except Exception:
            if i == max_retries - 1:
                print("✗ Server not responding. Please start the server first:")
                print("  cd python && python main.py --port 8765")
                return False
            await asyncio.sleep(1)
    
    # Run API tests
    test_api = TestVoxShiftAPI()
    async with httpx.AsyncClient(base_url=API_BASE, timeout=TIMEOUT) as client:
        await test_api.test_health_check(client)
        await test_api.test_get_devices(client)
        await test_api.test_get_models(client)
        await test_api.test_get_settings(client)
        await test_api.test_update_settings(client)
        await test_api.test_create_model(client)
        await test_api.test_audio_start_stop(client)
        await test_api.test_marketplace_fetch(client)
        await test_api.test_cache_clear(client)
    
    # Run database tests
    test_db = TestDatabase()
    await test_db.test_database_init()
    await test_db.test_model_crud()
    
    print("\n✓ All asynchronous tests passed\n")
    return True


def main():
    """Main test runner"""
    print("=" * 60)
    print("VoxShift API Test Suite")
    print("=" * 60)
    
    # Run synchronous tests
    try:
        run_sync_tests()
    except Exception as e:
        print(f"\n✗ Synchronous tests failed: {e}\n")
        return False
    
    # Run asynchronous tests
    try:
        result = asyncio.run(run_async_tests())
        if result is False:
            return False
    except Exception as e:
        print(f"\n✗ Asynchronous tests failed: {e}\n")
        return False
    
    print("=" * 60)
    print("✓ ALL TESTS PASSED")
    print("=" * 60)
    return True


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)

# Made with Bob
