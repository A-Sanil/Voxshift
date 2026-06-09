"""
Test runner that starts the server and runs all tests
"""
import subprocess
import time
import sys
import os
import io

# Fix Windows console encoding issues
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def main():
    print("=" * 60)
    print("VoxShift Test Runner")
    print("=" * 60)
    
    # Start the server in a subprocess
    print("\n[1/3] Starting Python backend server...")
    server_process = subprocess.Popen(
        [sys.executable, "main.py", "--port", "8765"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(__file__)
    )
    
    # Wait for server to start
    print("[2/3] Waiting for server to initialize...")
    time.sleep(3)
    
    # Run tests
    print("[3/3] Running tests...\n")
    try:
        result = subprocess.run(
            [sys.executable, "test_api.py"],
            cwd=os.path.dirname(__file__),
            timeout=60
        )
        success = result.returncode == 0
    except subprocess.TimeoutExpired:
        print("\n✗ Tests timed out")
        success = False
    except KeyboardInterrupt:
        print("\n✗ Tests interrupted")
        success = False
    finally:
        # Stop the server
        print("\nStopping server...")
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()
    
    if success:
        print("\n" + "=" * 60)
        print("✓ ALL TESTS PASSED")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("✗ SOME TESTS FAILED")
        print("=" * 60)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())

# Made with Bob
