import random
import logging
from uuid import UUID
from app.database.supabase import get_supabase_client
from app.services.audit_service import log_audit_event

logger = logging.getLogger("ruralcare.case")

def generate_case_id() -> str:
    number = random.randint(10000, 99999)
    return f"RT-{number}"

def is_uuid(val) -> bool:
    if not val:
        return False
    try:
        UUID(str(val))
        return True
    except ValueError:
        return False

def create_case(data: dict) -> dict:
    supabase = get_supabase_client()
    if not data.get("case_id"):
        data["case_id"] = generate_case_id()
    if not data.get("status"):
        data["status"] = "CREATED"
        
    try:
        # Resolve patient_id string (like 'PT-12345') to patients.id UUID
        if "patient_id" in data and isinstance(data["patient_id"], str) and not is_uuid(data["patient_id"]):
            p_res = supabase.table("patients").select("id").eq("patient_id", data["patient_id"]).execute()
            if p_res.data:
                data["patient_id"] = p_res.data[0]["id"]
            else:
                # Create a stub patient
                p_stub = supabase.table("patients").insert({
                    "patient_id": data["patient_id"],
                    "name": "Temporary Patient",
                    "age": 0,
                    "gender": "Unknown",
                    "phone": "0000000000"
                }).execute()
                if p_stub.data:
                    data["patient_id"] = p_stub.data[0]["id"]
                else:
                    raise Exception(f"Failed to create stub patient for {data['patient_id']}")

        # Resolve hospital_id if it's not a UUID or if it is null
        if "hospital_id" in data and data["hospital_id"] and not is_uuid(data["hospital_id"]):
            # Set to None if invalid UUID
            data["hospital_id"] = None

        # Check if case already exists
        existing = supabase.table("cases").select("*").eq("case_id", data["case_id"]).execute()
        if existing.data:
            response = supabase.table("cases").update(data).eq("case_id", data["case_id"]).execute()
        else:
            response = supabase.table("cases").insert(data).execute()
            
        if not response.data:
            raise Exception("Failed to insert/update case record")
        
        new_case = response.data[0]
        case_id_str = new_case["case_id"]
        
        # Log audit
        log_audit_event(
            case_id=new_case["id"],
            actor_type="PATIENT",
            actor_name="System Registration",
            action="CASE_CREATED",
            entity_type="cases",
            entity_id=new_case["id"]
        )
        
        return new_case
    except Exception as e:
        logger.error(f"Error creating/updating case: {str(e)}")
        raise e

def list_all_cases(patient_id: str = None) -> list:
    supabase = get_supabase_client()
    try:
        query = supabase.table("cases").select("case_id").order("created_at", desc=True)
        if patient_id:
            p_uuid = patient_id
            if not is_uuid(patient_id):
                p_res = supabase.table("patients").select("id").eq("patient_id", patient_id).execute()
                if p_res.data:
                    p_uuid = p_res.data[0]["id"]
                else:
                    # Patient ID not found in database -> return empty list
                    return []
            query = query.eq("patient_id", p_uuid)
            
        response = query.limit(20).execute()
        compiled_cases = []
        if response and response.data:
            for item in response.data:
                c = compile_clinical_case(item["case_id"])
                if c:
                    compiled_cases.append(c)
        return compiled_cases
    except Exception as e:
        logger.error(f"Error listing cases: {str(e)}")
        raise e

def update_case_status(case_id_str: str, new_status: str) -> dict:
    supabase = get_supabase_client()
    try:
        response = supabase.table("cases").update({"status": new_status}).eq("case_id", case_id_str).execute()
        if not response.data:
            raise Exception(f"Case {case_id_str} not found")
        
        case_data = response.data[0]
        log_audit_event(
            case_id=case_data["id"],
            actor_type="SYSTEM",
            actor_name="Workflow Manager",
            action="CASE_STATUS_UPDATED",
            entity_type="cases",
            entity_id=case_data["id"]
        )
        return case_data
    except Exception as e:
        logger.error(f"Error updating status for case {case_id_str}: {str(e)}")
        raise e

def compile_clinical_case(case_id_str: str) -> dict:
    supabase = get_supabase_client()
    
    # 1. Fetch case
    case_res = supabase.table("cases").select("*").eq("case_id", case_id_str).execute()
    if not case_res.data:
        return None
    case_data = case_res.data[0]
    case_uuid = case_data["id"]
    
    # 2. Fetch patient
    patient_data = {}
    if case_data.get("patient_id"):
        patient_res = supabase.table("patients").select("*").eq("id", case_data["patient_id"]).execute()
        patient_data = patient_res.data[0] if patient_res.data else {}
    
    # 3. Fetch voice session
    voice_res = supabase.table("voice_sessions").select("*").eq("case_id", case_uuid).execute()
    voice_data = voice_res.data[0] if voice_res.data else {}
    
    # 4. Fetch clinical summary
    summary_res = supabase.table("clinical_summaries").select("*").eq("case_id", case_uuid).execute()
    summary_data = summary_res.data[0] if summary_res.data else {}
    
    # 5. Fetch doctor review
    review_res = supabase.table("doctor_reviews").select("*").eq("case_id", case_uuid).execute()
    review_data = review_res.data[0] if review_res.data else {}
    
    # 6. Fetch prescription
    prescription_res = supabase.table("prescriptions").select("*").eq("case_id", case_uuid).execute()
    prescription_data = prescription_res.data[0] if prescription_res.data else {}
    
    # 7. Fetch queue token
    queue_res = supabase.table("queue_tokens").select("*").eq("case_id", case_uuid).execute()
    queue_data = queue_res.data[0] if queue_res.data else {}
    
    # 8. Fetch pharmacy order
    pharmacy_res = supabase.table("pharmacy_orders").select("*").eq("case_id", case_uuid).execute()
    pharmacy_data = pharmacy_res.data[0] if pharmacy_res.data else {}
    
    # Format triage levels to match frontend: 'Emergency' | 'Urgent' | 'Routine'
    ai_raw = case_data.get("ai_priority") or summary_data.get("ai_priority") or "Routine"
    ai_triage = ai_raw.capitalize() if ai_raw else "Routine"
    if ai_triage == "Low":
        ai_triage = "Routine"
    elif ai_triage == "Medium":
        ai_triage = "Urgent"
    elif ai_triage == "High":
        ai_triage = "Emergency"
        
    triage_priority = (case_data.get("final_priority") or ai_triage).capitalize()
    if triage_priority == "Low":
        triage_priority = "Routine"
    elif triage_priority == "Medium":
        triage_priority = "Urgent"
    elif triage_priority == "High":
        triage_priority = "Emergency"

    patient_obj = {
        "name": patient_data.get("name", ""),
        "age": patient_data.get("age", 0),
        "gender": patient_data.get("gender", ""),
        "phone": patient_data.get("phone", ""),
        "patientId": patient_data.get("patient_id", ""),
        "address": patient_data.get("address", ""),
        "emergencyContact": patient_data.get("emergency_contact", ""),
        "allergies": patient_data.get("allergies", ""),
        "medicalHistory": patient_data.get("medical_history", ""),
        "currentMedications": patient_data.get("current_medications", "")
    }
    
    status_map = {
        "CREATED": "Voice Submitted",
        "VOICE_SUBMITTED": "Voice Submitted",
        "AI_PROCESSING": "AI Summary",
        "DOCTOR_REVIEW": "Doctor Review",
        "DOCTOR_APPROVED": "Prescription",
        "HOSPITAL_RECEIVED": "Hospital Received",
        "QUEUE_ASSIGNED": "Queue",
        "PHARMACY_PREPARING": "Pharmacy",
        "PHARMACY_READY": "Pharmacy",
        "COMPLETED": "Dispensed",
        "EMERGENCY_ESCALATED": "Doctor Review"
    }
    
    raw_status = case_data.get("status", "CREATED")
    status = status_map.get(raw_status, raw_status)
    
    pharm_status = None
    if raw_status in ["PHARMACY_PREPARING", "PHARMACY_READY", "COMPLETED", "Pharmacy", "Dispensed"] or pharmacy_data:
        po_status = pharmacy_data.get("status", "RECEIVED")
        pharm_status_map = {
            "RECEIVED": "Received",
            "PREPARING": "Preparing",
            "READY": "Ready",
            "DISPENSED": "Dispensed"
        }
        pharm_status = pharm_status_map.get(po_status, "Received")
        if status in ["Prescription", "Hospital Received", "Queue"] and raw_status not in ["COMPLETED"]:
            status = "Pharmacy"

    arrival_time = "12:00 PM"
    if case_data.get("created_at"):
        try:
            parts = case_data["created_at"].split("T")
            if len(parts) > 1:
                t_parts = parts[1].split(":")
                hr = int(t_parts[0])
                mn = t_parts[1]
                ampm = "AM"
                if hr >= 12:
                    ampm = "PM"
                    if hr > 12:
                        hr -= 12
                elif hr == 0:
                    hr = 12
                arrival_time = f"{hr:02d}:{mn} {ampm}"
        except:
            pass

    clinical_case = {
        "id": case_id_str,
        "patient": patient_obj,
        "language": voice_data.get("detected_language", "Tamil-English mixed"),
        "originalTranscript": voice_data.get("transcript", case_data.get("main_complaint", "")),
        
        # AI Extracted Details
        "aiClinicalSummary": summary_data.get("summary", ""),
        "aiSymptoms": summary_data.get("symptoms", []),
        "aiDuration": summary_data.get("duration", ""),
        "aiSeverity": summary_data.get("severity", "Medium"),
        "aiConfidence": summary_data.get("ai_confidence", 90),
        "aiTriageRecommend": ai_triage,
        
        # Doctor Verification / Overrides
        "triagePriority": triage_priority,
        "assignedDepartment": review_data.get("department") or case_data.get("department") or "General Medicine",
        "observations": review_data.get("clinical_observations", ""),
        "doctorName": review_data.get("doctor_name", ""),
        "doctorApproved": prescription_data.get("approval_status") == "APPROVED" or raw_status in ["DOCTOR_APPROVED", "HOSPITAL_RECEIVED", "QUEUE_ASSIGNED", "PHARMACY_PREPARING", "PHARMACY_READY", "COMPLETED"],
        "prescriptionDate": prescription_data.get("created_at", "").split("T")[0] if prescription_data.get("created_at") else None,
        
        # Prescription Items
        "prescriptionItems": prescription_data.get("medicines", []),
        "followUpDate": prescription_data.get("follow_up_date", ""),
        
        # Operational Details
        "status": status,
        "tokenNumber": queue_data.get("token_number"),
        "estimatedWaitingTime": queue_data.get("estimated_wait_minutes"),
        "arrivalTime": arrival_time,
        "pharmacyStatus": pharm_status,
        
        # IVR/Phone Details
        "channel": case_data.get("channel", "voice_web"),
        "callerPhone": case_data.get("caller_phone", ""),
        "locationText": case_data.get("location_text", ""),
        "locationSource": case_data.get("location_source", ""),
        "languageCode": case_data.get("language_code", "")
    }
    
    return clinical_case
