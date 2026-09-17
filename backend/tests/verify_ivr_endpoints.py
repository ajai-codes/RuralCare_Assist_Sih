import httpx
import sys

BASE_URL = "http://localhost:8000"

def run_ivr_tests():
    print("Starting IVR Endpoint Verification...")
    
    with httpx.Client(timeout=10.0) as client:
        # 1. Test config endpoint
        print("\n--- 1. Testing GET /api/ivr/config ---")
        try:
            res = client.get(f"{BASE_URL}/api/ivr/config")
            print(f"GET /api/ivr/config: {res.status_code} - {res.json()}")
            assert res.status_code == 200
            assert "ivr_mode" in res.json()
            assert "demo_patient_phone" in res.json()
        except Exception as e:
            print(f"IVR config test failed: {e}")
            return False
            
        # 2. Test incoming webhook
        print("\n--- 2. Testing POST /api/ivr/webhook/incoming ---")
        try:
            payload = {"call_sid": "CA12345", "from_phone": "+919876543210"}
            res = client.post(f"{BASE_URL}/api/ivr/webhook/incoming", json=payload)
            print(f"POST /api/ivr/webhook/incoming: {res.status_code} - {res.json()}")
            assert res.status_code == 200
            assert res.json()["success"] == True
        except Exception as e:
            print(f"Incoming call webhook failed: {e}")
            return False

        # 3. Test audio webhook
        print("\n--- 3. Testing POST /api/ivr/webhook/audio ---")
        try:
            payload = {"call_sid": "CA12345", "audio_chunk_base64": "UklGRg=="}
            res = client.post(f"{BASE_URL}/api/ivr/webhook/audio", json=payload)
            print(f"POST /api/ivr/webhook/audio: {res.status_code} - {res.json()}")
            assert res.status_code == 200
            assert res.json()["success"] == True
        except Exception as e:
            print(f"Audio webhook failed: {e}")
            return False

        # 4. Test status webhook
        print("\n--- 4. Testing POST /api/ivr/webhook/status ---")
        try:
            payload = {"call_sid": "CA12345", "status": "ringing"}
            res = client.post(f"{BASE_URL}/api/ivr/webhook/status", json=payload)
            print(f"POST /api/ivr/webhook/status: {res.status_code} - {res.json()}")
            assert res.status_code == 200
            assert res.json()["success"] == True
        except Exception as e:
            print(f"Status webhook failed: {e}")
            return False

        # 5. Test callback webhook
        print("\n--- 5. Testing POST /api/ivr/callback ---")
        try:
            payload = {"digits": "1"}
            res = client.post(f"{BASE_URL}/api/ivr/callback", json=payload)
            print(f"POST /api/ivr/callback: {res.status_code} - {res.json()}")
            assert res.status_code == 200
            assert res.json()["success"] == True
        except Exception as e:
            print(f"Callback webhook failed: {e}")
            return False

        print("\n==============================================")
        print(" Rural Care IVR webhooks: ALL TESTS PASSED!")
        print("==============================================")
        return True

if __name__ == "__main__":
    success = run_ivr_tests()
    sys.exit(0 if success else 1)
