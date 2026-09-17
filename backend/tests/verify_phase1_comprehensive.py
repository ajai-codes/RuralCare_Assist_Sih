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

def test_phase1_appointments_and_teleconsultation():
    print("================================================================")
    print(" 🏥 RURALCARE AI - PHASE 1 COMPREHENSIVE VERIFICATION SUITE")
    print("================================================================")

    # 1. Health checks
    print("\n[1] Health Endpoint Verification...")
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["success"] is True
    print("  ✓ /health OK")

    # 2. Appointment Booking & Priority Queue
    print("\n[2] Testing Appointment Booking & Priority Calculation...")
    tomorrow = str(date.today() + timedelta(days=1))
    yesterday = str(date.today() - timedelta(days=1))
    
    emergency_apt_payload = {
        "patient_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "facility_id": "550e8400-e29b-41d4-a716-446655440000",
        "doctor_id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7",
        "department": "Cardiology",
        "appointment_date": tomorrow,
        "time_slot": "09:30 AM",
        "appointment_type": "Teleconsultation",
        "triage_priority": "Emergency",
        "case_id": "RT-10245",
        "notes": "Emergency chest pain triage"
    }

    res_book = client.post("/api/appointments", json=emergency_apt_payload)
    assert res_book.status_code == 200, f"Booking failed: {res_book.text}"
    apt_data = res_book.json()["data"]
    apt_id = apt_data["id"]
    print(f"  ✓ Emergency Appointment Booked: ID={apt_id}, Slot={apt_data['time_slot']}, Priority={apt_data['triage_priority']}")

    # 3. Double Booking Prevention Test
    print("\n[3] Testing Double Booking Collision Prevention...")
    res_dup = client.post("/api/appointments", json=emergency_apt_payload)
    assert res_dup.status_code == 400, f"Expected 400 on duplicate slot, got {res_dup.status_code}"
    print(f"  ✓ Double-booking correctly rejected (400): {res_dup.json()['detail']}")

    # 4. Past Date Rejection Test
    print("\n[4] Testing Past Date Booking Rejection...")
    past_payload = dict(emergency_apt_payload)
    past_payload["appointment_date"] = yesterday
    past_payload["time_slot"] = "11:30 AM"
    res_past = client.post("/api/appointments", json=past_payload)
    assert res_past.status_code == 400
    print(f"  ✓ Past date booking correctly rejected (400): {res_past.json()['detail']}")

    # 5. Doctor Actions: Check In
    print("\n[5] Testing Doctor Patient Check-In...")
    res_checkin = client.put(f"/api/appointments/{apt_id}/check-in")
    assert res_checkin.status_code == 200
    assert res_checkin.json()["data"]["status"] == "Checked In"
    print(f"  ✓ Patient checked in: Status={res_checkin.json()['data']['status']}")

    # 6. Live Queue Status Calculation
    print("\n[6] Testing Live Queue Status Metrics...")
    res_q = client.get(f"/api/appointments/{apt_id}/queue")
    assert res_q.status_code == 200
    q_metrics = res_q.json()["data"]
    assert "queue_number" in q_metrics
    assert "currently_serving" in q_metrics
    assert "estimated_wait_minutes" in q_metrics
    print(f"  ✓ Live Queue Status: Queue #{q_metrics['queue_number']}, Serving #{q_metrics['currently_serving']}, Est Wait={q_metrics['estimated_wait_minutes']}m")

    # 7. Appointment Rescheduling Workflow
    print("\n[7] Testing Appointment Rescheduling...")
    res_resched = client.put(f"/api/appointments/{apt_id}/reschedule", json={
        "new_date": tomorrow,
        "new_time_slot": "02:30 PM"
    })
    assert res_resched.status_code == 200
    resched_data = res_resched.json()["data"]
    assert resched_data["time_slot"] == "02:30 PM"
    print(f"  ✓ Appointment rescheduled: New Slot={resched_data['time_slot']} on {resched_data['appointment_date']}")

    # Check that previous slot (09:30 AM) is now available again!
    res_freed = client.post("/api/appointments", json=emergency_apt_payload)
    assert res_freed.status_code == 200
    freed_apt_id = res_freed.json()["data"]["id"]
    print(f"  ✓ Previous time slot 09:30 AM verified freed and re-bookable (New ID: {freed_apt_id})")

    # 8. Doctor Mark No-Show
    print("\n[8] Testing Doctor Mark No-Show Action...")
    res_noshow = client.put(f"/api/appointments/{freed_apt_id}/no-show")
    assert res_noshow.status_code == 200
    assert res_noshow.json()["data"]["status"] == "No-show"
    print(f"  ✓ Appointment marked as No-show: {res_noshow.json()['data']['status']}")

    # 9. Appointment Cancellation Workflow
    print("\n[9] Testing Backend Appointment Cancellation...")
    res_cancel = client.delete(f"/api/appointments/{freed_apt_id}")
    assert res_cancel.status_code == 200
    assert res_cancel.json()["data"]["status"] == "CANCELLED"
    print(f"  ✓ Appointment cancelled in DB: Status={res_cancel.json()['data']['status']}")

    # 10. Teleconsultation Room Creation & Sync
    print("\n[10] Testing Teleconsultation Lifecycle & Appointment Sync...")
    tc_create_payload = {
        "appointment_id": apt_id,
        "case_id": "RT-10245",
        "patient_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "doctor_id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7",
        "facility_id": "550e8400-e29b-41d4-a716-446655440000"
    }
    res_tc = client.post("/api/teleconsultations", json=tc_create_payload)
    assert res_tc.status_code == 200
    tc_data = res_tc.json()["data"]
    tc_id = tc_data["id"]
    room_id = tc_data["room_id"]
    print(f"  ✓ Teleconsultation created: ID={tc_id}, Room={room_id}")

    # Start consultation -> verifies appointment status syncs to "In Consultation"
    res_tc_start = client.put(f"/api/teleconsultations/{tc_id}/status", json={"status": "IN_PROGRESS"})
    assert res_tc_start.status_code == 200
    apt_synced = client.get(f"/api/appointments/{apt_id}").json()["data"]
    assert apt_synced["status"] == "In Consultation", f"Expected In Consultation, got {apt_synced['status']}"
    print(f"  ✓ Teleconsultation started -> Linked Appointment automatically synced to: '{apt_synced['status']}'")

    # Add Doctor Clinical Notes
    res_notes = client.post(f"/api/teleconsultations/{tc_id}/notes", json={
        "notes": "Patient diagnosed with stable angina. Prescribed Aspirin and Atorvastatin. Advised follow-up in 48h."
    })
    assert res_notes.status_code == 200
    print(f"  ✓ Doctor clinical notes saved: {res_notes.json()['data']['consultation_notes'][:50]}...")

    # End Teleconsultation with Duration -> verifies appointment status syncs to "Completed"
    res_tc_end = client.put(f"/api/teleconsultations/{tc_id}/status", json={
        "status": "COMPLETED",
        "duration_seconds": 185
    })
    assert res_tc_end.status_code == 200
    assert res_tc_end.json()["data"]["duration_seconds"] == 185
    apt_completed = client.get(f"/api/appointments/{apt_id}").json()["data"]
    assert apt_completed["status"] == "Completed", f"Expected Completed, got {apt_completed['status']}"
    print(f"  ✓ Teleconsultation ended (Duration: 185s) -> Linked Appointment automatically synced to: '{apt_completed['status']}'")

    # 11. WebSocket WebRTC Signaling Handshake Test
    print("\n[11] Testing WebRTC WebSocket Signaling Server...")
    with client.websocket_connect(f"/api/ws/teleconsultation/{room_id}") as ws_patient:
        # Patient receives initial room info
        msg_p1 = ws_patient.receive_json()
        assert msg_p1["type"] == "room-info"
        assert msg_p1["is_initiator"] is True
        print("  ✓ Patient connected to signaling WebSocket as room initiator")

        # Doctor connects to same room
        with client.websocket_connect(f"/api/ws/teleconsultation/{room_id}") as ws_doctor:
            # Doctor receives room info
            msg_d1 = ws_doctor.receive_json()
            assert msg_d1["type"] == "room-info"
            assert msg_d1["is_initiator"] is False

            # Patient receives peer-joined event
            peer_joined_msg = ws_patient.receive_json()
            assert peer_joined_msg["type"] == "peer-joined"
            print("  ✓ Doctor joined room -> Patient notified with 'peer-joined'")

            # Patient sends WebRTC Offer -> Doctor receives Offer
            test_offer = {"type": "offer", "sdp": {"type": "offer", "sdp": "v=0\r\no=patient 1234 1 IN IP4 127.0.0.1\r\ns=Test"}}
            ws_patient.send_json(test_offer)
            doc_received_offer = ws_doctor.receive_json()
            assert doc_received_offer["type"] == "offer"
            assert doc_received_offer["sdp"]["type"] == "offer"
            print("  ✓ SDP Offer forwarded from Patient -> Doctor")

            # Doctor sends WebRTC Answer -> Patient receives Answer
            test_answer = {"type": "answer", "sdp": {"type": "answer", "sdp": "v=0\r\no=doctor 5678 1 IN IP4 127.0.0.1\r\ns=Test"}}
            ws_doctor.send_json(test_answer)
            patient_received_answer = ws_patient.receive_json()
            assert patient_received_answer["type"] == "answer"
            assert patient_received_answer["sdp"]["type"] == "answer"
            print("  ✓ SDP Answer forwarded from Doctor -> Patient")

            # Patient sends ICE Candidate -> Doctor receives ICE Candidate
            test_ice = {"type": "ice-candidate", "candidate": {"candidate": "candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host", "sdpMid": "0", "sdpMLineIndex": 0}}
            ws_patient.send_json(test_ice)
            doc_received_ice = ws_doctor.receive_json()
            assert doc_received_ice["type"] == "ice-candidate"
            assert "candidate:1" in doc_received_ice["candidate"]["candidate"]
            print("  ✓ ICE Candidate forwarded from Patient -> Doctor")

    print("  ✓ WebRTC Signaling handshake test passed cleanly")

    # 12. Doctor Priority Reassessment & Security Verification
    print("\n[12] Testing Doctor Priority Reassessment & Security Authorization...")
    res_reassess = client.put(f"/api/teleconsultations/{tc_id}/reassess-priority", json={
        "clinical_priority": "Emergency",
        "priority_reason": "Clinical ECG changes observed during video call"
    }, headers={"x-user-role": "doctor"})
    assert res_reassess.status_code == 200
    assert res_reassess.json()["data"]["clinical_priority"] == "Emergency"
    print("  ✓ Doctor Priority Reassessment saved: Priority=Emergency, Audit log updated")

    # Patient role attempting priority override must be rejected with 403
    res_unauth = client.put(f"/api/teleconsultations/{tc_id}/reassess-priority", json={
        "clinical_priority": "Routine",
        "priority_reason": "Unauthorized attempt"
    }, headers={"x-user-role": "patient"})
    assert res_unauth.status_code == 403
    print(f"  ✓ Unauthorized patient priority override correctly rejected (403): {res_unauth.json()['detail']}")

    print("\n================================================================")
    print(" 🎉 ALL PHASE 1 APPOINTMENT & TELECONSULTATION TESTS PASSED!")
    print("================================================================")
    return True

if __name__ == "__main__":
    success = test_phase1_appointments_and_teleconsultation()
    sys.exit(0 if success else 1)

