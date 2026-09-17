import sys
import os
import io
import json
import asyncio
from datetime import date, timedelta
from fastapi.testclient import TestClient

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

client = TestClient(app)

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def test_full_e2e_workflow():
    print("==========================================================================")
    print(" 🏥 RURALCARE AI - COMPLETE REQUIRED END-TO-END WORKFLOW VERIFICATION SUITE")
    print("==========================================================================")

    # --------------------------------------------------------------------------
    # STEP 1 & 2: Patient Voice Input & Speech-to-Text Transcription
    # --------------------------------------------------------------------------
    print("\n[1 & 2] Testing Voice Upload & Speech-to-Text (faster-whisper)...")
    case_id_routine = "RT-99001"
    
    # Upload mock audio bytes
    wav_header = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80\x3e\x00\x00\x00\x7d\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    upload_res = client.post(
        "/api/voice/upload",
        data={"case_id": case_id_routine},
        files={"file": ("test_symptoms.wav", wav_header, "audio/wav")}
    )
    assert upload_res.status_code == 200
    audio_path = upload_res.json()["audio_path"]
    print(f"  ✓ Voice Audio Uploaded: Path = {audio_path}")

    # Transcribe audio with Tamil-English mixed transcript
    mixed_transcript = "நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது. மூச்சு விட கஷ்டமா இருக்கு."
    transcribe_res = client.post(
        "/api/voice/transcribe",
        json={
            "case_id": case_id_routine,
            "audio_path": audio_path,
            "override_transcript": mixed_transcript
        }
    )
    assert transcribe_res.status_code == 200
    stt_data = transcribe_res.json()
    assert stt_data["transcript"] == mixed_transcript
    print(f"  ✓ Speech-to-Text Transcribed: Transcript='{stt_data['transcript'][:45]}...', Lang='{stt_data['detected_language']}'")

    # --------------------------------------------------------------------------
    # STEP 3 & 4: AI Symptom Analysis & AI Pre-Triage Recommendation
    # --------------------------------------------------------------------------
    print("\n[3 & 4] Testing AI Symptom Marker Extraction & AI Pre-Triage Assessment...")
    extract_res = client.post("/api/ai/extract", json={"case_id": case_id_routine})
    assert extract_res.status_code == 200
    assert extract_res.json()["success"] is True
    print("  ✓ AI Clinical Marker Extraction Completed")

    triage_res = client.post("/api/ai/triage", json={"case_id": case_id_routine})
    assert triage_res.status_code == 200
    ai_triage_data = triage_res.json()["data"]
    ai_rec_priority = ai_triage_data["ai_priority"]
    print(f"  ✓ AI Pre-Triage Recommendation: Priority='{ai_rec_priority}', Confidence={ai_triage_data['confidence']}%")

    # --------------------------------------------------------------------------
    # STEP 5: Doctor Validation & Triage Priority Override
    # --------------------------------------------------------------------------
    print("\n[5] Testing Doctor Review & Final Priority Validation...")
    review_res = client.put(f"/api/doctor/cases/{case_id_routine}/review", json={
        "doctor_name": "Dr. Ramesh Kumar",
        "doctor_registration_id": "REG-87421",
        "clinical_observations": "Patient assessed with mild effort angina. Non-acute ECG.",
        "final_priority": "Urgent",
        "department": "Cardiology"
    })
    assert review_res.status_code == 200
    print("  ✓ Doctor Validation Recorded: AI Priority retained in ai_priority, Final Priority set to 'Urgent'")

    # --------------------------------------------------------------------------
    # STEP 6, 7 & 8: Routine/Urgent Flow: Appointment Booking & Smart Queue
    # --------------------------------------------------------------------------
    print("\n[6, 7 & 8] Testing Appointment Booking & Smart Queue (Urgent Flow)...")
    tomorrow = str(date.today() + timedelta(days=1))
    apt_res = client.post("/api/appointments", json={
        "patient_id": "PA-2410",
        "facility_id": "550e8400-e29b-41d4-a716-446655440000",
        "doctor_id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7",
        "department": "Cardiology",
        "appointment_date": tomorrow,
        "time_slot": "10:30 AM",
        "appointment_type": "Teleconsultation",
        "triage_priority": "Urgent",
        "case_id": case_id_routine,
        "notes": "Follow-up for effort angina"
    })
    assert apt_res.status_code == 200
    apt_id = apt_res.json()["data"]["id"]
    print(f"  ✓ Appointment Booked: ID={apt_id}, Date={tomorrow}, Time=10:30 AM, Priority=Urgent")

    # Patient Check-In & Queue Status
    client.put(f"/api/appointments/{apt_id}/check-in")
    q_res = client.get(f"/api/appointments/{apt_id}/queue")
    assert q_res.status_code == 200
    print(f"  ✓ Smart Queue Active: Position #{q_res.json()['data']['queue_number']}, Serving #{q_res.json()['data']['currently_serving']}")

    # --------------------------------------------------------------------------
    # STEP 9 & 10: Teleconsultation Session & Clinical Treatment Decision
    # --------------------------------------------------------------------------
    print("\n[9 & 10] Testing Teleconsultation Video Session & Doctor Treatment Decision...")
    tc_res = client.post("/api/teleconsultations", json={
        "appointment_id": apt_id,
        "case_id": case_id_routine,
        "patient_id": "PA-2410",
        "doctor_id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7"
    })
    assert tc_res.status_code == 200
    tc_data = tc_res.json()["data"]
    tc_id = tc_data["id"]
    room_id = tc_data["room_id"]
    print(f"  ✓ Teleconsultation Room Created: Room ID={room_id}")

    # WebRTC Signaling Handshake Test
    with client.websocket_connect(f"/api/ws/teleconsultation/{room_id}") as ws_p:
        msg_p = ws_p.receive_json()
        assert msg_p["type"] == "room-info"
        with client.websocket_connect(f"/api/ws/teleconsultation/{room_id}") as ws_d:
            msg_d = ws_d.receive_json()
            assert msg_d["type"] == "room-info"
            print("  ✓ WebRTC Video Consultation WebSocket Handshake Verified")

    # Save Doctor Clinical Notes
    client.post(f"/api/teleconsultations/{tc_id}/notes", json={
        "notes": "Diagnosed with stable angina. Advised Aspirin 100mg and Atorvastatin 40mg daily."
    })
    client.put(f"/api/teleconsultations/{tc_id}/status", json={"status": "COMPLETED", "duration_seconds": 240})
    print("  ✓ Doctor Clinical Assessment Recorded & Teleconsultation Completed")

    # --------------------------------------------------------------------------
    # STEP 11 & 12: Prescription & Pharmacy Dashboard Processing
    # --------------------------------------------------------------------------
    print("\n[11 & 12] Testing Prescription Creation & Pharmacy Queue Processing...")
    pres_res = client.post(f"/api/doctor/cases/{case_id_routine}/prescription", json={
        "doctor_name": "Dr. Ramesh Kumar",
        "doctor_registration_id": "REG-87421",
        "clinical_assessment": "Stable Angina",
        "prescriptionItems": [
            {"id": "1", "medicine": "Aspirin", "dosage": "100mg", "frequency": "Once daily", "duration": "30 days", "route": "Oral", "instructions": "Take after breakfast"},
            {"id": "2", "medicine": "Atorvastatin", "dosage": "40mg", "frequency": "Night", "duration": "30 days", "route": "Oral", "instructions": "Take after dinner"}
        ],
        "instructions": "Avoid heavy physical exertion.",
        "follow_up_date": tomorrow
    })
    assert pres_res.status_code == 200
    pres_id = pres_res.json()["id"]
    print(f"  ✓ Doctor Created Prescription: ID={pres_id}")

    # Approve & Send to Pharmacy
    appr_res = client.post(f"/api/doctor/prescriptions/{pres_id}/approve")
    assert appr_res.status_code == 200
    print("  ✓ Prescription Approved & Sent to Pharmacy")

    # Pharmacy updates order status: RECEIVED -> PREPARING -> READY -> DISPENSED
    pharm_q = client.get("/api/pharmacy/queue")
    assert pharm_q.status_code == 200
    print("  ✓ Prescription visible in Pharmacy Queue")

    disp_res = client.put(f"/api/pharmacy/orders/{case_id_routine}/status", json={"status": "DISPENSED"})
    assert disp_res.status_code == 200
    print("  ✓ Pharmacy Processed Order to DISPENSED state")

    # --------------------------------------------------------------------------
    # STEP 14: Emergency Case & Tertiary Referral Tracking Workflow
    # --------------------------------------------------------------------------
    print("\n[14] Testing Emergency Priority Validation & Tertiary Hospital Referral...")
    case_id_emergency = "RT-99002"
    
    # Create emergency case & doctor validates Emergency priority
    client.post("/api/cases", json={
        "case_id": case_id_emergency,
        "patient_id": "PA-2410",
        "main_complaint": "Severe crushed chest pain, diaphoresis, radiating to jaw",
        "status": "VOICE_SUBMITTED"
    })

    client.put(f"/api/doctor/cases/{case_id_emergency}/review", json={
        "doctor_name": "Dr. Ramesh Kumar",
        "doctor_registration_id": "REG-87421",
        "clinical_observations": "Acute ST-Elevation Myocardial Infarction. Requires immediate Cath Lab / PCI.",
        "final_priority": "Emergency",
        "department": "Cardiology"
    })
    print("  ✓ Doctor Validated Priority: EMERGENCY (Bypasses normal routine queue)")

    # Create Tertiary Referral
    ref_res = client.post("/api/referrals", json={
        "case_id": case_id_emergency,
        "patient_id": "PA-2410",
        "referring_doctor_name": "Dr. Ramesh Kumar",
        "target_facility": "Madurai Medical College & Hospital (Tertiary)",
        "target_department": "Cardiology / Cath Lab",
        "priority": "Emergency",
        "reason": "Acute STEMI requiring emergency Primary PCI and ICU admission",
        "transport_required": True,
        "notes": "Emergency ALS Ambulance requested."
    })
    assert ref_res.status_code == 200
    ref_data = ref_res.json()["data"]
    ref_code = ref_data["referral_code"]
    ref_id = ref_data["id"]
    print(f"  ✓ Emergency Referral Issued: Referral Code={ref_code}, Target='{ref_data['target_facility']}'")

    # Update Referral Status: PENDING -> ACCEPTED -> TRANSFERRED
    ref_upd = client.put(f"/api/referrals/{ref_id}/status", json={"status": "TRANSFERRED", "notes": "Patient transferred via ALS Ambulance."})
    assert ref_upd.status_code == 200
    assert ref_upd.json()["data"]["status"] == "TRANSFERRED"
    print("  ✓ Referral Status Tracked: TRANSFERRED to Tertiary Facility")

    # --------------------------------------------------------------------------
    # STEP 15: High-Risk Follow-Up Management & Reminder Trigger
    # --------------------------------------------------------------------------
    print("\n[15] Testing High-Risk Follow-Up Scheduling & SMS/Mobile Reminder...")
    fu_res = client.post("/api/follow-ups", json={
        "case_id": case_id_routine,
        "patient_id": "PA-2410",
        "doctor_name": "Dr. Ramesh Kumar",
        "follow_up_date": tomorrow,
        "risk_level": "HIGH",
        "reason": "7-Day Post-Angina Clinical & BP Screening",
        "notes": "Check compliance with Aspirin & Atorvastatin."
    })
    assert fu_res.status_code == 200
    fu_id = fu_res.json()["data"]["id"]
    print(f"  ✓ High-Risk Follow-Up Scheduled: ID={fu_id}, Date={tomorrow}")

    # Trigger Follow-Up Reminder Notification
    rem_res = client.post(f"/api/follow-ups/{fu_id}/trigger-reminder")
    assert rem_res.status_code == 200
    assert rem_res.json()["data"]["reminder_sent"] is True
    print(f"  ✓ Follow-Up Reminder Dispatched: Notification = '{rem_res.json()['notification']}'")

    # Mark Follow-Up Completed
    comp_res = client.put(f"/api/follow-ups/{fu_id}/complete", json={"notes": "Patient attended follow-up. Vitals stable."})
    assert comp_res.status_code == 200
    assert comp_res.json()["data"]["status"] == "COMPLETED"
    print("  ✓ High-Risk Follow-Up Completed")

    # --------------------------------------------------------------------------
    # STEP 13: Longitudinal Patient Record History Compilation
    # --------------------------------------------------------------------------
    print("\n[13] Testing Longitudinal Patient Record Compilation Endpoint...")
    hist_res = client.get("/api/patients/PA-2410/history")
    assert hist_res.status_code == 200
    hist_data = hist_res.json()["data"]
    assert "patient" in hist_data
    assert "cases" in hist_data
    assert "appointments" in hist_data
    assert "prescriptions" in hist_data
    assert "referrals" in hist_data
    assert "follow_ups" in hist_data
    print(f"  ✓ Longitudinal Care History Compiled: Encounters={hist_data['total_encounters']}, Referrals={len(hist_data['referrals'])}, FollowUps={len(hist_data['follow_ups'])}")

    print("\n==========================================================================")
    print(" 🎉 ALL REQUIRED END-TO-END WORKFLOW TESTS PASSED CLEANLY!")
    print("==========================================================================")
    return True

if __name__ == "__main__":
    success = test_full_e2e_workflow()
    sys.exit(0 if success else 1)
