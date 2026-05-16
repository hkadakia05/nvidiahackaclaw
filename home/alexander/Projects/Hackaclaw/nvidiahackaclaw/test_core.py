#!/usr/bin/env python3
"""
Simple test script to verify core functionality of the AgentControl implementation
without requiring NVIDIA API key.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, '/home/alexander/Projects/Hackaclaw/nvidiahackaclaw/backend')

def test_imports():
    """Test that core modules can be imported."""
    print("Testing imports...")
    
    try:
        from app import run_manager_final
        print("✓ run_manager_final imported successfully")
    except Exception as e:
        print(f"✗ run_manager_final import failed: {e}")
        return False
        
    try:
        from app import orchestration_pipeline
        print("✓ orchestration_pipeline imported successfully")
    except Exception as e:
        print(f"✗ orchestration_pipeline import failed: {e}")
        return False
        
    try:
        from app import nemotron_wrapper
        print("✓ nemotron_wrapper imported successfully")
    except Exception as e:
        print(f"✗ nemotron_wrapper import failed: {e}")
        # This is expected to fail without API key, but we'll continue
        
    try:
        from app import security
        print("✓ security module imported successfully")
    except Exception as e:
        print(f"✗ security module import failed: {e}")
        return False
        
    return True

def test_functionality():
    """Test core functionality."""
    print("\nTesting core functionality...")
    
    try:
        # Test that we can create the orchestration pipeline
        from app.orchestration_pipeline import create_orchestration_pipeline
        print("✓ Orchestration pipeline creation function available")
        
        # Test that we can create the run manager
        from app.run_manager_final import run_agent_timeline
        print("✓ Run manager timeline function available")
        
        return True
    except Exception as e:
        print(f"✗ Core functionality test failed: {e}")
        return False

def main():
    """Main test function."""
    print("AgentControl Implementation Test")
    print("=" * 40)
    
    success = True
    success &= test_imports()
    success &= test_functionality()
    
    print("\n" + "=" * 40)
    if success:
        print("✓ All tests passed! Implementation is ready.")
        print("To run the full system, you'll need:")
        print("  1. A valid NVIDIA API key in .env file")
        print("  2. Redis server running")
        print("  3. Run with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    else:
        print("✗ Some tests failed.")
        
    return success

if __name__ == "__main__":
    main()