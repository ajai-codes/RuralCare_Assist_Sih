import logging
from app.database.supabase import get_supabase_client
from app.services.audit_service import log_audit_event

logger = logging.getLogger("ruralcare.prescription")

def create_prescription(case_id_str: str, data: dict) -> dict:
    supabase = get_supabase_client()
    try:
        # Get case UUID
        case_res = supabase.table("cases").select("*").eq("case_id", case_id_str).execute()
        if not case_res.data:
            raise Exception("Case not found")
        case_data = case_res.data[0]
        case_uuid = case_data["id"]
        
        # Prepare payload
        payload = {
            "case_id": case_uuid,
            "doctor_name": data["doctor_name"],
            "doctor_registration_id": data["doctor_registration_id"],
            "clinical_assessment": data.get("clinical_assessment", ""),
            "medicines": data.get("prescriptionItems", []), # JSONB
            "instructions": data.get("instructions", ""),
            "follow_up_date": data.get("follow_up_date") or None,
            "approval_status": "DRAFT"
        }
        
        # Delete existing prescriptions for this case to keep it clean
        supabase.table("prescriptions").delete().eq("case_id", case_uuid).execute()
        
        response = supabase.table("prescriptions").insert(payload).execute()
        if not response.data:
            raise Exception("Failed to insert prescription record")
            
        prescription = response.data[0]
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="DOCTOR",
            actor_name=data["doctor_name"],
            action="PRESCRIPTION_CREATED",
            entity_type="prescriptions",
            entity_id=prescription["id"]
        )
        return prescription
    except Exception as e:
        logger.error(f"Error in create_prescription: {str(e)}")
        raise e

def approve_prescription(prescription_id: str) -> dict:
    supabase = get_supabase_client()
    try:
        pres_res = supabase.table("prescriptions").select("*").eq("id", prescription_id).execute()
        if not pres_res.data:
            raise Exception("Prescription not found")
        prescription = pres_res.data[0]
        case_uuid = prescription["case_id"]
        
        # 1. Update prescription status
        from datetime import datetime
        supabase.table("prescriptions").update({
            "approval_status": "APPROVED",
            "approved_at": datetime.utcnow().isoformat() + "Z"
        }).eq("id", prescription_id).execute()
        
        # 2. Get case details
        case_res = supabase.table("cases").select("*").eq("id", case_uuid).execute()
        if not case_res.data:
            raise Exception("Associated case not found")
        case_data = case_res.data[0]
        case_id_str = case_data["case_id"]
        hospital_uuid = case_data.get("hospital_id")
        if not hospital_uuid:
            hosp_res = supabase.table("hospitals").select("id").limit(1).execute()
            if hosp_res.data:
                hospital_uuid = hosp_res.data[0]["id"]
        department = case_data.get("department") or "General Medicine"
        
        # 3. Update case status to DOCTOR_APPROVED
        supabase.table("cases").update({
            "status": "DOCTOR_APPROVED"
        }).eq("id", case_uuid).execute()
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="DOCTOR",
            actor_name=prescription["doctor_name"],
            action="PRESCRIPTION_APPROVED",
            entity_type="prescriptions",
            entity_id=prescription_id
        )
        
        # 4. Hospital pre-registration and queue token generation
        from app.services.queue_service import generate_queue_token
        try:
            generate_queue_token(case_uuid, hospital_uuid, department)
        except Exception as q_err:
            logger.error(f"Failed to generate queue token: {str(q_err)}")
            
        # 5. Pharmacy order creation
        if hospital_uuid:
            hosp_res = supabase.table("hospitals").select("pharmacy_enabled").eq("id", hospital_uuid).execute()
            if hosp_res.data and hosp_res.data[0].get("pharmacy_enabled", True):
                from app.services.pharmacy_service import create_pharmacy_order
                try:
                    create_pharmacy_order(case_uuid, prescription_id, hospital_uuid)
                except Exception as p_err:
                    logger.error(f"Failed to create pharmacy order: {str(p_err)}")
                    
        # Return compiled case
        from app.services.case_service import compile_clinical_case
        return compile_clinical_case(case_id_str)
        
    except Exception as e:
        logger.error(f"Error in approve_prescription: {str(e)}")
        raise e
