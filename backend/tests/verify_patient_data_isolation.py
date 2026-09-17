"""
RURALCARE ASSIST — PATIENT DATA ISOLATION VERIFICATION TEST
============================================================
This script creates two test patients (Patient A and Patient B) in the backend database with distinct cases,
appointments, and follow-ups, and rigorously tests that:
1. Patient A's query returns ONLY Patient A's records.
2. Patient B's query returns ONLY Patient B's records.
3. Patient A's data NEVER appears in Patient B's API responses or vice versa.
4. An empty patient query returns an EMPTY state (0 records) and NEVER leaks other patients' data.
5. Cross-patient authorization checks return 403 Forbidden for unauthorized access.
"""

import sys
import os
import io
from datetime import datetime, timedelta

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def log(msg, status="INFO"):
    symbol = "OK" if status == "PASS" else "FAIL" if status == "FAIL" else "INFO"
    print(f"[{symbol}] [{status}] {msg}")

def test_patient_data_isolation():
    print("\n" + "="*70)
    print("      RURALCARE ASSIST — PATIENT DATA ISOLATION AUDIT TEST")
    print("="*70 + "\n")

    timestamp = datetime.now().strftime("%H%M%S")
    patient_a_id = f"PAT-ISO-A-{timestamp}"
    patient_b_id = f"PAT-ISO-B-{timestamp}"

    # -------------------------------------------------------------
    # STEP 1: Create Case for Patient A
    # -------------------------------------------------------------
    log(f"Creating clinical case for Patient A (ID: {patient_a_id})...")
    case_a_payload = {
        "patient_id": patient_a_id,
        "main_complaint": "Severe shortness of breath and chest discomfort since morning.",
        "ai_priority": "Emergency",
        "final_priority": "Emergency",
        "department": "Cardiology",
        "channel": "voice_web",
        "language_code": "en"
    }
    res_a = client.post("/api/cases", json=case_a_payload)
    if res_a.status_code != 200:
        log(f"Failed to create case for Patient A: {res_a.text}", "FAIL")
        sys.exit(1)
    case_a_data = res_a.json().get("data", res_a.json())
    case_a_id = case_a_data.get("case_id") or case_a_data.get("id")
    log(f"Case created for Patient A: {case_a_id}", "PASS")

    # -------------------------------------------------------------
    # STEP 2: Create Case for Patient B
    # -------------------------------------------------------------
    log(f"Creating clinical case for Patient B (ID: {patient_b_id})...")
    case_b_payload = {
        "patient_id": patient_b_id,
        "main_complaint": "Severe right knee joint swelling and difficulty walking for 2 days.",
        "ai_priority": "Routine",
        "final_priority": "Routine",
        "department": "Orthopedics",
        "channel": "voice_web",
        "language_code": "en"
    }
    res_b = client.post("/api/cases", json=case_b_payload)
    if res_b.status_code != 200:
        log(f"Failed to create case for Patient B: {res_b.text}", "FAIL")
        sys.exit(1)
    case_b_data = res_b.json().get("data", res_b.json())
    case_b_id = case_b_data.get("case_id") or case_b_data.get("id")
    log(f"Case created for Patient B: {case_b_id}", "PASS")

    # -------------------------------------------------------------
    # STEP 3: Create Appointment for Patient A
    # -------------------------------------------------------------
    tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    apt_a_payload = {
        "patient_id": patient_a_id,
        "facility_id": "550e8400-e29b-41d4-a716-446655440000",
        "department": "Cardiology",
        "appointment_date": tomorrow_str,
        "time_slot": "09:00 AM",
        "appointment_type": "Teleconsultation",
        "triage_priority": "Emergency",
        "case_id": case_a_id
    }
    res_apt_a = client.post("/api/appointments", json=apt_a_payload, headers={"x-user-id": patient_a_id, "x-user-role": "patient"})
    if res_apt_a.status_code != 200:
        log(f"Failed to create appointment for Patient A: {res_apt_a.text}", "FAIL")
        sys.exit(1)
    apt_a_data = res_apt_a.json().get("data", res_apt_a.json())
    log(f"Appointment created for Patient A: {apt_a_data.get('id')}", "PASS")

    # -------------------------------------------------------------
    # STEP 4: Create Appointment for Patient B
    # -------------------------------------------------------------
    apt_b_payload = {
        "patient_id": patient_b_id,
        "facility_id": "550e8400-e29b-41d4-a716-446655440000",
        "department": "Orthopedics",
        "appointment_date": tomorrow_str,
        "time_slot": "11:30 AM",
        "appointment_type": "In-Person",
        "triage_priority": "Routine",
        "case_id": case_b_id
    }
    res_apt_b = client.post("/api/appointments", json=apt_b_payload, headers={"x-user-id": patient_b_id, "x-user-role": "patient"})
    if res_apt_b.status_code != 200:
        log(f"Failed to create appointment for Patient B: {res_apt_b.text}", "FAIL")
        sys.exit(1)
    apt_b_data = res_apt_b.json().get("data", res_apt_b.json())
    log(f"Appointment created for Patient B: {apt_b_data.get('id')}", "PASS")

    # -------------------------------------------------------------
    # STEP 5: Create Follow-Up for Patient A
    # -------------------------------------------------------------
    fu_a_payload = {
        "case_id": case_a_id,
        "patient_id": patient_a_id,
        "follow_up_date": tomorrow_str,
        "reason": "Cardiac post-emergency evaluation",
        "risk_level": "HIGH"
    }
    res_fu_a = client.post("/api/follow-ups", json=fu_a_payload, headers={"x-user-id": patient_a_id, "x-user-role": "patient"})
    if res_fu_a.status_code != 200:
        log(f"Failed to create follow-up for Patient A: {res_fu_a.text}", "FAIL")
        sys.exit(1)
    fu_a_data = res_fu_a.json().get("data")
    fu_a_id = fu_a_data.get("id")
    log(f"Follow-Up created for Patient A: {fu_a_id}", "PASS")

    # =============================================================
    # AUDIT VERIFICATION CHECKS
    # =============================================================

    # -------------------------------------------------------------
    # CHECK 1: Query Patient A Cases
    # -------------------------------------------------------------
    log(f"Verifying GET /api/cases?patient_id={patient_a_id}...")
    resp_cases_a = client.get(f"/api/cases?patient_id={patient_a_id}")
    res_a_json = resp_cases_a.json()
    cases_a = res_a_json if isinstance(res_a_json, list) else res_a_json.get("data", [])
    
    a_case_ids = [c.get("id") or c.get("case_id") for c in cases_a]
    if case_a_id in a_case_ids and case_b_id not in a_case_ids:
        log(f"Patient A cases returned strictly Patient A data ({len(cases_a)} cases). Patient B case ({case_b_id}) was NOT present.", "PASS")
    else:
        log(f"DATA LEAK DETECTED! Patient A received cases: {a_case_ids}, Expected only: {case_a_id}", "FAIL")
        sys.exit(1)

    # -------------------------------------------------------------
    # CHECK 2: Query Patient B Cases
    # -------------------------------------------------------------
    log(f"Verifying GET /api/cases?patient_id={patient_b_id}...")
    resp_cases_b = client.get(f"/api/cases?patient_id={patient_b_id}")
    res_b_json = resp_cases_b.json()
    cases_b = res_b_json if isinstance(res_b_json, list) else res_b_json.get("data", [])
    
    b_case_ids = [c.get("id") or c.get("case_id") for c in cases_b]
    if case_b_id in b_case_ids and case_a_id not in b_case_ids:
        log(f"Patient B cases returned strictly Patient B data ({len(cases_b)} cases). Patient A case ({case_a_id}) was NOT present.", "PASS")
    else:
        log(f"DATA LEAK DETECTED! Patient B received cases: {b_case_ids}, Expected only: {case_b_id}", "FAIL")
        sys.exit(1)

    # -------------------------------------------------------------
    # CHECK 3: Query Non-Existent/New Patient Cases
    # -------------------------------------------------------------
    empty_pid = f"PAT-EMPTY-{timestamp}"
    log(f"Verifying GET /api/cases?patient_id={empty_pid} for brand new patient with 0 records...")
    resp_cases_empty = client.get(f"/api/cases?patient_id={empty_pid}")
    res_e_json = resp_cases_empty.json()
    cases_empty = res_e_json if isinstance(res_e_json, list) else res_e_json.get("data", [])
    
    if len(cases_empty) == 0:
        log("Brand new patient received 0 cases (Clean Empty State). Zero fallback/demo patient data leaked!", "PASS")
    else:
        log(f"DATA LEAK DETECTED! Empty patient received {len(cases_empty)} cases from other patients!", "FAIL")
        sys.exit(1)

    # -------------------------------------------------------------
    # CHECK 4: Query Patient A Appointments
    # -------------------------------------------------------------
    log(f"Verifying GET /api/appointments?patient_id={patient_a_id}...")
    resp_apts_a = client.get(f"/api/appointments?patient_id={patient_a_id}", headers={"x-user-id": patient_a_id, "x-user-role": "patient"})
    apts_a_json = resp_apts_a.json()
    apts_a = apts_a_json if isinstance(apts_a_json, list) else apts_a_json.get("data", [])
    apt_a_ids = [a.get("id") for a in apts_a]
    if apt_a_data.get("id") in apt_a_ids and apt_b_data.get("id") not in apt_a_ids:
        log(f"Patient A appointments returned strictly Patient A data ({len(apts_a)} apts). Patient B apt was NOT present.", "PASS")
    else:
        log(f"DATA LEAK DETECTED in appointments for Patient A!", "FAIL")
        sys.exit(1)

    # -------------------------------------------------------------
    # CHECK 5: Query Patient B Appointments
    # -------------------------------------------------------------
    log(f"Verifying GET /api/appointments?patient_id={patient_b_id}...")
    resp_apts_b = client.get(f"/api/appointments?patient_id={patient_b_id}", headers={"x-user-id": patient_b_id, "x-user-role": "patient"})
    apts_b_json = resp_apts_b.json()
    apts_b = apts_b_json if isinstance(apts_b_json, list) else apts_b_json.get("data", [])
    apt_b_ids = [a.get("id") for a in apts_b]
    if apt_b_data.get("id") in apt_b_ids and apt_a_data.get("id") not in apt_b_ids:
        log(f"Patient B appointments returned strictly Patient B data ({len(apts_b)} apts). Patient A apt was NOT present.", "PASS")
    else:
        log(f"DATA LEAK DETECTED in appointments for Patient B!", "FAIL")
        sys.exit(1)

    # -------------------------------------------------------------
    # CHECK 6: Query Follow-Ups for Patient A vs Patient B
    # -------------------------------------------------------------
    log(f"Verifying GET /api/follow-ups?patient_id={patient_a_id}...")
    resp_fu_a = client.get(f"/api/follow-ups?patient_id={patient_a_id}", headers={"x-user-id": patient_a_id, "x-user-role": "patient"})
    fu_a_json = resp_fu_a.json().get("data", [])
    fu_a_ids = [f.get("id") for f in fu_a_json]
    if fu_a_id in fu_a_ids:
        log(f"Patient A follow-ups returned strictly Patient A data ({len(fu_a_json)} follow-ups).", "PASS")
    else:
        log("Patient A follow-up missing!", "FAIL")
        sys.exit(1)

    log(f"Verifying GET /api/follow-ups for Patient B (should be 0)...")
    resp_fu_b = client.get(f"/api/follow-ups?patient_id={patient_b_id}", headers={"x-user-id": patient_b_id, "x-user-role": "patient"})
    fu_b_json = resp_fu_b.json().get("data", [])
    if len(fu_b_json) == 0 and fu_a_id not in [f.get("id") for f in fu_b_json]:
        log(f"Patient B follow-ups query returned 0 records. Patient A follow-up was NOT leaked.", "PASS")
    else:
        log("DATA LEAK DETECTED in Patient B follow-ups!", "FAIL")
        sys.exit(1)

    # -------------------------------------------------------------
    # CHECK 7: Query Longitudinal Record for Patient A
    # -------------------------------------------------------------
    log(f"Verifying GET /api/patients/{patient_a_id}/history...")
    resp_hist_a = client.get(f"/api/patients/{patient_a_id}/history", headers={"x-user-id": patient_a_id, "x-user-role": "patient"})
    hist_a_json = resp_hist_a.json()
    hist_a = hist_a_json.get("data") if isinstance(hist_a_json, dict) and "data" in hist_a_json else hist_a_json
    hist_a_cases = [c.get("case_id") or c.get("id") for c in hist_a.get("cases", [])]
    if case_a_id in hist_a_cases and case_b_id not in hist_a_cases:
        log(f"Patient A longitudinal record returned strictly Patient A history. Patient B case was NOT present.", "PASS")
    else:
        log("DATA LEAK DETECTED in Patient A longitudinal history!", "FAIL")
        sys.exit(1)

    # -------------------------------------------------------------
    # CHECK 8: Cross-Patient Unauthorized Access Rejection (HTTP 403)
    # -------------------------------------------------------------
    log(f"Verifying Patient B attempting to access Patient A's longitudinal history (expecting HTTP 403)...")
    resp_unauth = client.get(f"/api/patients/{patient_a_id}/history", headers={"x-user-id": patient_b_id, "x-user-role": "patient"})
    if resp_unauth.status_code == 403:
        log("Unauthorized cross-patient access correctly blocked with HTTP 403 Forbidden.", "PASS")
    else:
        log(f"SECURITY VULNERABILITY! Unauthorized patient access returned HTTP {resp_unauth.status_code} instead of 403!", "FAIL")
        sys.exit(1)

    print("\n" + "="*70)
    print("  ALL PATIENT DATA ISOLATION & CROSS-PATIENT LEAK TESTS PASSED!")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_patient_data_isolation()

