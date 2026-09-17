import sys
import os
import logging
from datetime import date, timedelta
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ruralcare.test_followup")

client = TestClient(app)

def run_tests():
    logger.info("==========================================================================")
    logger.info(" 🔔 RURALCARE AI - FEATURE 6: HIGH-RISK FOLLOW-UP VERIFICATION SUITE")
    logger.info("==========================================================================")

    patient_with_phone = "PA-2410" # Has registered phone 9443218765
    patient_no_phone = "PA-NO-PHONE-99"
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    # --------------------------------------------------------------------------
    # TEST 1 & 2: Doctor Creates High-Risk Follow-Up & Persistence Verification
    # --------------------------------------------------------------------------
    logger.info("[1 & 2] Testing Doctor High-Risk Follow-Up Creation & Persistence...")
    fu_payload_phone = {
        "case_id": "RT-99001",
        "patient_id": patient_with_phone,
        "doctor_name": "Dr. Anand Sharma",
        "facility_name": "Madurai Medical College & Hospital",
        "follow_up_date": tomorrow,
        "follow_up_time": "10:30 AM",
        "risk_level": "HIGH",
        "reason": "Post-triage chest pain re-evaluation and cardiac enzyme check",
        "notes": "Bring previous ECG and prescription slip."
    }
    
    res1 = client.post("/api/follow-ups", json=fu_payload_phone, headers={"x-user-role": "doctor"})
    assert res1.status_code == 200, f"Follow-up creation failed: {res1.text}"
    data1 = res1.json()["data"]
    fu_id_phone = data1["id"]

    logger.info(f"  ✓ High-Risk Follow-Up Created: ID={fu_id_phone}, Date={data1['follow_up_date']}")
    assert data1["status"] == "PENDING"
    assert data1["risk_level"] == "HIGH"

    # --------------------------------------------------------------------------
    # TEST 5 & 6: Phone-Equipped Patient Notification (SMS + App Notification)
    # --------------------------------------------------------------------------
    logger.info("[5 & 6] Testing Dual Notification Engine (Phone Available)...")
    assert data1["notification_mode"] == "SMS_AND_APP", f"Expected SMS_AND_APP, got {data1.get('notification_mode')}"
    assert data1["reminder_sent"] == True
    assert "sms_body" in data1 and "RuralCare Assist:" in data1["sms_body"]
    logger.info(f"  ✓ Phone Notification Engine Verified: Mode={data1['notification_mode']}")
    logger.info(f"    • Queued SMS Body: '{data1['sms_body']}'")

    # --------------------------------------------------------------------------
    # TEST 7: No-Phone Patient Printed Slip Mode Generation
    # --------------------------------------------------------------------------
    logger.info("[7] Testing Dual Notification Engine (No Mobile Phone -> Printable Slip)...")
    fu_payload_no_phone = {
        "case_id": "RT-99002",
        "patient_id": patient_no_phone,
        "doctor_name": "Dr. Subha Raman",
        "facility_name": "Madurai Medical College & Hospital",
        "follow_up_date": tomorrow,
        "follow_up_time": "11:00 AM",
        "risk_level": "HIGH",
        "reason": "Severe laceration dressing change and wound check",
        "notes": "Keep dressing clean and dry."
    }

    res2 = client.post("/api/follow-ups", json=fu_payload_no_phone, headers={"x-user-role": "doctor"})
    assert res2.status_code == 200, f"No-phone follow-up creation failed: {res2.text}"
    data2 = res2.json()["data"]
    fu_id_no_phone = data2["id"]

    assert data2["notification_mode"] == "PRINTED_SLIP", f"Expected PRINTED_SLIP mode, got {data2.get('notification_mode')}"
    logger.info(f"  ✓ Printable Slip Mode Verified: Notification Mode={data2['notification_mode']}")

    # Fetch printable slip details endpoint
    res_slip = client.get(f"/api/follow-ups/{fu_id_no_phone}/slip", headers={"x-user-role": "doctor"})
    assert res_slip.status_code == 200, f"Failed to fetch follow-up slip: {res_slip.text}"
    slip_data = res_slip.json()["data"]
    assert slip_data["notification_mode"] == "PRINTED_SLIP"
    assert "printed_at" in slip_data
    logger.info(f"  ✓ Printable Follow-Up Slip Data Compiled: Patient={slip_data['patient_name']}, Facility={slip_data['facility_name']}")

    # --------------------------------------------------------------------------
    # TEST 3 & 4: Doctor & Patient Dashboard Access
    # --------------------------------------------------------------------------
    logger.info("[3 & 4] Testing Doctor & Patient Dashboard Retrieval...")
    
    # Doctor listing follow-ups
    res_doc = client.get("/api/follow-ups", headers={"x-user-role": "doctor"})
    assert res_doc.status_code == 200
    doc_fus = res_doc.json()["data"]
    logger.info(f"  ✓ Doctor Dashboard Follow-Up Queue: {len(doc_fus)} active follow-ups retrieved")

    # Patient fetching own follow-ups
    res_pt = client.get(f"/api/follow-ups?patient_id={patient_with_phone}", headers={"x-user-role": "patient", "x-user-id": patient_with_phone})
    assert res_pt.status_code == 200
    pt_fus = res_pt.json()["data"]
    logger.info(f"  ✓ Patient Dashboard Follow-Up List: {len(pt_fus)} follow-ups retrieved for patient")

    # --------------------------------------------------------------------------
    # TEST 12 & 13: Authorization & IDOR Protection
    # --------------------------------------------------------------------------
    logger.info("[12 & 13] Testing Server-Side Authorization & IDOR Protection...")
    res_idor = client.get(
        f"/api/follow-ups?patient_id=OTHER-PATIENT-UUID",
        headers={"x-user-role": "patient", "x-user-id": "UNAUTHORIZED-PATIENT"}
    )
    assert res_idor.status_code == 403, f"Expected 403 Forbidden for IDOR attempt, got {res_idor.status_code}"
    logger.info("  ✓ IDOR Attack Blocked (403 Forbidden Correctly Returned)")

    # --------------------------------------------------------------------------
    # TEST 8, 9 & 10: Closed-Loop Follow-Up Completion & Re-assessment
    # --------------------------------------------------------------------------
    logger.info("[8, 9 & 10] Testing Patient Return, Doctor Re-Assessment & Completion...")
    res_comp = client.put(
        f"/api/follow-ups/{fu_id_phone}/complete",
        json={"notes": "Patient attended follow-up clinic. Symptoms resolved. Treatment completed."},
        headers={"x-user-role": "doctor"}
    )
    assert res_comp.status_code == 200
    comp_data = res_comp.json()["data"]
    assert comp_data["status"] == "COMPLETED"
    logger.info(f"  ✓ Follow-Up Re-Assessment Completed: Status={comp_data['status']}")

    # Verify presence in Longitudinal Record History
    res_hist = client.get(f"/api/patients/{patient_with_phone}/history", headers={"x-user-role": "doctor"})
    assert res_hist.status_code == 200
    timeline = res_hist.json()["data"]["timeline_events"]
    fu_events = [e for e in timeline if e.get("type") == "follow_up"]
    assert len(fu_events) > 0, "Follow-up event must be present in Longitudinal Timeline"
    logger.info(f"  ✓ Closed-Loop Longitudinal Record Integration Verified: {len(fu_events)} follow-up events in timeline")

    logger.info("==========================================================================")
    logger.info(" 🎉 FEATURE 6: HIGH-RISK FOLLOW-UP VERIFICATION PASSED CLEANLY!")
    logger.info("==========================================================================")

if __name__ == "__main__":
    run_tests()
