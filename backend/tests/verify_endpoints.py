import os
import sys
import random
import io
from fastapi.testclient import TestClient

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
client = TestClient(app, raise_server_exceptions=False)

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', write_through=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', write_through=True)

def run_tests():
    print("Starting Rural Triage Backend E2E verification...")
    
    # 1. Health checks
    print("\n--- 1. Testing Health Endpoints ---")
    try:
        res = client.get("/health")
        print(f"GET /health: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        assert res.json()["success"] == True
    except Exception as e:
        print(f"Health test failed: {e}")
        return False
        
    try:
        res = client.get("/health/services")
        print(f"GET /health/services: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        assert "api" in res.json()
        assert "supabase" in res.json()
        assert "whisper" in res.json()
    except Exception as e:
        print(f"Services health test failed: {e}")
        return False

    # 2. Patient endpoints (Singular & Plural aliases)
    print("\n--- 2. Testing Patient Endpoints ---")
    test_patient = {
        "name": "E2E Verification Patient",
        "age": 39,
        "gender": "Female",
        "phone": "9876543210",
        "preferred_language": "Tamil",
        "allergies": "None",
        "medical_history": "Hypertension",
        "current_medications": "None"
    }
    
    try:
        res = client.post("/api/patient", json=test_patient)
        print(f"POST /api/patient: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        data = res.json()["data"]
        patient_code = data["patient_code"]
        assert patient_code.startswith("RT-") or patient_code.startswith("PT-")
        print(f"Registered patient with code: {patient_code}")
    except Exception as e:
        print(f"Patient registration failed: {e}")
        return False
        
    try:
        res = client.get(f"/api/patient/{patient_code}")
        print(f"GET /api/patient/{patient_code}: {res.status_code} - {res.text}")
        assert res.status_code == 200
        assert res.json()["data"]["name"] == "E2E Verification Patient"
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Patient retrieval failed: {e}")
        return False

    # 3. Case creation and voice simulation
    print("\n--- 3. Testing Case & Transcription Endpoints ---")
    case_id = f"RT-{random.randint(10000, 99999)}"
    try:
        # Create case
        case_payload = {
            "case_id": case_id,
            "patient_id": patient_code,
            "main_complaint": "Severe chest pain starting yesterday night",
            "status": "CREATED"
        }
        res = client.post("/api/cases", json=case_payload)
        print(f"POST /api/cases: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        
        # Transcribe (with override transcript for E2E check)
        transcribe_payload = {
            "case_id": case_id,
            "audio_path": f"patient-audio/{case_id}/recording.webm",
            "override_transcript": "நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது."
        }
        res = client.post("/api/voice/transcribe", json=transcribe_payload)
        print(f"POST /api/voice/transcribe: {res.status_code} - {res.json()}")
        assert res.status_code == 200
    except Exception as e:
        print(f"Case or transcription test failed: {e}")
        return False

    # 4. AI Clinical Extraction and Triage
    print("\n--- 4. Testing AI Pipelines ---")
    try:
        # Clinical extraction
        res = client.post("/api/ai/extract", json={"case_id": case_id})
        print(f"POST /api/ai/extract: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        assert "chief_complaint" in res.json()["data"]
        
        # Triage recommendation
        res = client.post("/api/ai/triage", json={"case_id": case_id})
        print(f"POST /api/ai/triage: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        assert "triage_level" in res.json()["data"]
        # Chest pain must determine EMERGENCY triage priority
        assert res.json()["data"]["triage_level"] == "EMERGENCY"
    except Exception as e:
        print(f"AI pipeline test failed: {e}")
        return False

    # 5. Doctor reviews and prescriptions
    print("\n--- 5. Testing Doctor Review & Prescription Endpoints ---")
    try:
        # Doctor review
        review_payload = {
            "doctor_name": "Dr. Ramesh Kumar",
            "doctor_registration_id": "REG-87421",
            "clinical_observations": "ECG shows ST depressions.",
            "final_priority": "Emergency",
            "department": "Cardiology"
        }
        res = client.put(f"/api/doctor/cases/{case_id}/review", json=review_payload)
        print(f"PUT /api/doctor/cases/{{id}}/review: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        
        # Create draft prescription (new singular route)
        prescription_payload = {
            "case_id": case_id,
            "doctor_name": "Dr. Ramesh Kumar",
            "doctor_registration_id": "REG-87421",
            "medication": "Aspirin",
            "dosage": "300mg",
            "frequency": "Once immediately",
            "duration": "Stat",
            "instructions": "Chew immediately",
            "status": "DRAFT"
        }
        res = client.post("/api/prescriptions", json=prescription_payload)
        print(f"POST /api/prescriptions: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        prescription_id = res.json()["data"]["id"]
        
        # Retrieve prescription (singular route)
        res = client.get(f"/api/prescriptions/{prescription_id}")
        print(f"GET /api/prescriptions/{{id}}: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        
        # Approve prescription
        res = client.post(f"/api/prescriptions/{prescription_id}/approve")
        print(f"POST /api/prescriptions/{{id}}/approve: {res.status_code} - {res.json()}")
        assert res.status_code == 200
    except Exception as e:
        print(f"Doctor/Prescription test failed: {e}")
        return False

    # 6. Information request workflow
    print("\n--- 6. Testing Information Requests ---")
    try:
        # Request information
        req_payload = {
            "question": "What is the patient's current oxygen saturation (SpO2)?"
        }
        res = client.post(f"/api/doctor/cases/{case_id}/request-information", json=req_payload)
        print(f"POST /api/doctor/cases/{{id}}/request-information: {res.status_code} - {res.json()}")
        assert res.status_code == 200
        req_id = res.json()["data"]["id"]
        
        # Respond to request
        resp_payload = {
            "response": "SpO2 is 95% on room air."
        }
        res = client.put(f"/api/doctor/cases/{case_id}/information-requests/{req_id}", json=resp_payload)
        print(f"PUT /api/doctor/cases/{{id}}/information-requests/{{req_id}}: {res.status_code} - {res.json()}")
        assert res.status_code == 200
    except Exception as e:
        print(f"Information request test failed: {e}")
        return False

    # 7. Pharmacy queue endpoints
    print("\n--- 7. Testing Pharmacy Endpoints ---")
    try:
        # Get pharmacy queue
        res = client.get("/api/pharmacy/queue")
        print(f"GET /api/pharmacy/queue: {res.status_code} - (Found {len(res.json())} cases)")
        assert res.status_code == 200
        
        # Update prescription status
        res = client.put(f"/api/pharmacy/prescriptions/{prescription_id}/status", json={"status": "dispensed"})
        print(f"PUT /api/pharmacy/prescriptions/{{id}}/status: {res.status_code} - {res.json()}")
        assert res.status_code == 200
    except Exception as e:
        print(f"Pharmacy test failed: {e}")
        return False

    print("\n==============================================")
    print(" Rural Triage E2E verification: ALL TESTS PASSED!")
    print("==============================================")
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
