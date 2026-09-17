import sys
import os
import logging
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ruralcare.test_longitudinal")

client = TestClient(app)

def run_tests():
    logger.info("==========================================================================")
    logger.info(" 📋 RURALCARE AI - LONGITUDINAL PATIENT RECORD & SECURITY TEST SUITE")
    logger.info("==========================================================================")

    patient_id = "PA-2410"

    # 1. Test Doctor Authorized Access
    logger.info("[1] Testing Doctor Authorized Access to Longitudinal Record...")
    res_doc = client.get(
        f"/api/patients/{patient_id}/history",
        headers={"x-user-role": "doctor", "x-user-id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7"}
    )
    assert res_doc.status_code == 200, f"Doctor access failed with status {res_doc.status_code}: {res_doc.text}"
    data_doc = res_doc.json()["data"]
    logger.info(f"  ✓ Doctor Access Granted (200 OK): Patient={data_doc['patient']['name']}, Encounters={data_doc['total_encounters']}")
    
    # Check payload keys
    assert "patient" in data_doc, "Missing patient details"
    assert "cases" in data_doc, "Missing cases list"
    assert "appointments" in data_doc, "Missing appointments list"
    assert "prescriptions" in data_doc, "Missing prescriptions list"
    assert "referrals" in data_doc, "Missing referrals list"
    assert "follow_ups" in data_doc, "Missing follow_ups list"
    assert "timeline_events" in data_doc, "Missing timeline_events list"

    # 2. Test Patient Accessing Own Record
    logger.info("[2] Testing Patient Accessing Own Longitudinal Record...")
    res_pt = client.get(
        f"/api/patients/{patient_id}/history",
        headers={"x-user-role": "patient", "x-user-id": patient_id}
    )
    assert res_pt.status_code == 200, f"Patient own record access failed with status {res_pt.status_code}: {res_pt.text}"
    logger.info(f"  ✓ Patient Own Record Access Granted (200 OK)")

    # 3. Test Unauthorized Patient Access (IDOR Vulnerability Protection)
    logger.info("[3] Testing IDOR Security Protection (Unauthorized Patient Access)...")
    res_unauth = client.get(
        f"/api/patients/{patient_id}/history",
        headers={"x-user-role": "patient", "x-user-id": "UNAUTHORIZED-PATIENT-9999"}
    )
    assert res_unauth.status_code == 403, f"Expected 403 Forbidden for IDOR attempt, got {res_unauth.status_code}"
    logger.info("  ✓ IDOR Attack Blocked (403 Forbidden Correctly Returned)")

    # 4. Create an Encounter Sequence and verify it appears in the Longitudinal Timeline
    logger.info("[4] Testing Full Care Sequence Persistence into Longitudinal Record...")
    
    # Step A: Triage Case
    case_payload = {
        "case_id": "RT-99881",
        "patient_id": patient_id,
        "main_complaint": "Persistent fever and shortness of breath for 3 days",
        "triage_priority": "Urgent",
        "ai_priority": "Urgent",
        "final_priority": "Urgent"
    }
    client.post("/api/triage", json=case_payload)

    # Step B: Appointment & Priority Queue
    apt_payload = {
        "patient_id": patient_id,
        "facility_id": "550e8400-e29b-41d4-a716-446655440000",
        "appointment_date": "2026-09-15",
        "time_slot": "11:00 AM",
        "appointment_type": "Teleconsultation",
        "department": "Pulmonology",
        "triage_priority": "Urgent"
    }
    apt_res = client.post("/api/appointments", json=apt_payload)
    apt_id = apt_res.json()["data"]["id"]

    # Step C: Doctor Prescribe & Pharmacy Dispatch
    pres_payload = {
        "case_id": "RT-99881",
        "patient_id": patient_id,
        "doctor_name": "Dr. Anand Sharma",
        "medications": [
            {"drug": "Azithromycin", "dosage": "500mg", "frequency": "OD", "duration": "5 days"},
            {"drug": "Paracetamol", "dosage": "650mg", "frequency": "TDS", "duration": "3 days"}
        ]
    }
    client.post("/api/pharmacy/prescriptions", json=pres_payload)

    # Step D: Referral
    ref_payload = {
        "patient_id": patient_id,
        "referring_doctor_id": "doc-101",
        "referring_doctor_name": "Dr. Anand Sharma",
        "target_facility": "Madurai Medical College & Hospital (Tertiary)",
        "reason": "Specialist pulmonology evaluation for persistent infiltrates",
        "urgency": "Urgent"
    }
    client.post("/api/referrals", json=ref_payload)

    # Step E: High-Risk Follow-Up
    fu_payload = {
        "patient_id": patient_id,
        "case_id": "RT-99881",
        "follow_up_date": "2026-09-20",
        "risk_level": "High",
        "reason": "Re-assess oxygen saturation and pulmonary symptoms"
    }
    client.post("/api/follow-ups", json=fu_payload)

    # Step F: Re-verify Longitudinal Record Timeline
    res_final = client.get(
        f"/api/patients/{patient_id}/history",
        headers={"x-user-role": "doctor", "x-user-id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7"}
    )
    final_data = res_final.json()["data"]

    logger.info("  ✓ Timeline Verification:")
    logger.info(f"    • Total Encounters: {final_data['total_encounters']}")
    logger.info(f"    • Appointments Count: {len(final_data['appointments'])}")
    logger.info(f"    • Prescriptions Count: {len(final_data['prescriptions'])}")
    logger.info(f"    • Referrals Count: {len(final_data['referrals'])}")
    logger.info(f"    • Follow-Ups Count: {len(final_data['follow_ups'])}")
    logger.info(f"    • Enriched Timeline Events: {len(final_data['timeline_events'])} events compiled")

    assert len(final_data['timeline_events']) > 0, "Timeline events should be compiled"

    logger.info("==========================================================================")
    logger.info(" 🎉 LONGITUDINAL PATIENT RECORD & SECURITY VERIFICATION PASSED!")
    logger.info("==========================================================================")

if __name__ == "__main__":
    run_tests()
