from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database.supabase import get_supabase_client
from app.services import case_service
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/doctor", tags=["doctor"])

class CaseReview(BaseModel):
    doctor_name: str
    doctor_registration_id: str
    clinical_observations: Optional[str] = None
    final_priority: Optional[str] = None
    department: Optional[str] = None
    additional_information_requested: Optional[str] = None
    decision: Optional[str] = None # For prompt schema alignment
    notes: Optional[str] = None # For prompt schema alignment

class MedicineItem(BaseModel):
    id: str
    medicine: str
    dosage: str
    frequency: str
    duration: str
    route: str
    instructions: Optional[str] = None

class PrescriptionCreate(BaseModel):
    doctor_name: str
    doctor_registration_id: str
    clinical_assessment: Optional[str] = None
    prescriptionItems: List[MedicineItem]
    instructions: Optional[str] = None
    follow_up_date: Optional[str] = None

class InfoRequestCreate(BaseModel):
    doctor_id: Optional[str] = None
    worker_id: Optional[str] = None
    question: str

class InfoRequestRespond(BaseModel):
    response: str

@router.get("/cases")
def list_doctor_cases(priority: Optional[str] = Query(None)):
    try:
        cases = case_service.list_all_cases()
        if priority:
            p_lower = priority.lower()
            # Handle both formats (e.g. 'Emergency' or 'EMERGENCY')
            cases = [c for c in cases if c.get("triagePriority", "").lower() == p_lower or c.get("status", "").lower() == p_lower]
        return cases
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cases/{case_id}")
def get_doctor_case(case_id: str):
    res = case_service.compile_clinical_case(case_id)
    if not res:
        raise HTTPException(status_code=404, detail="Case not found")
    return res

@router.put("/cases/{case_id}/review")
def review_case(case_id: str, payload: CaseReview):
    supabase = get_supabase_client()
    try:
        # Get case UUID
        case_res = supabase.table("cases").select("*").eq("case_id", case_id).execute()
        if not case_res.data:
            case_res = supabase.table("cases").select("*").eq("id", case_id).execute()
            if not case_res.data:
                raise HTTPException(status_code=404, detail="Case not found")
        case_data = case_res.data[0]
        case_uuid = case_data["id"]
        
        # Determine fields mapping
        notes = payload.clinical_observations or payload.notes or ""
        decision = payload.final_priority or payload.decision or "ROUTINE"
        db_triage = decision.upper()
        
        # Save doctor review
        review_payload = {
            "case_id": case_uuid,
            "doctor_name": payload.doctor_name,
            "doctor_registration_id": payload.doctor_registration_id,
            "clinical_observations": notes,
            "final_priority": decision.capitalize(),
            "decision": db_triage,
            "notes": notes,
            "department": payload.department,
            "additional_information_requested": payload.additional_information_requested,
            "review_status": "COMPLETED"
        }
        
        # Check if review already exists
        existing = supabase.table("doctor_reviews").select("id").eq("case_id", case_uuid).execute()
        if existing.data:
            supabase.table("doctor_reviews").update(review_payload).eq("case_id", case_uuid).execute()
        else:
            supabase.table("doctor_reviews").insert(review_payload).execute()
            
        # Update case priority, department, status, and triage_level
        supabase.table("cases").update({
            "status": "DOCTOR_REVIEW",
            "final_priority": decision.capitalize(),
            "triage_level": db_triage,
            "department": payload.department,
            "assigned_doctor_id": review_payload.get("doctor_id")
        }).eq("id", case_uuid).execute()
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="DOCTOR",
            actor_name=payload.doctor_name,
            action="DOCTOR_REVIEWED_CASE",
            entity_type="doctor_reviews",
            entity_id=case_uuid
        )
        
        return {
            "success": True,
            "message": "Doctor review details recorded successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cases/{case_id}/prescription")
def create_draft_prescription(case_id: str, payload: PrescriptionCreate):
    from app.services import prescription_service
    try:
        data = payload.model_dump(exclude_unset=True)
        res = prescription_service.create_prescription(case_id, data)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create prescription draft: {str(e)}")

@router.post("/prescriptions/{prescription_id}/approve")
def approve_doctor_prescription(prescription_id: str):
    from app.services import prescription_service
    try:
        res = prescription_service.approve_prescription(prescription_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve prescription: {str(e)}")

@router.post("/cases/{case_id}/request-information")
def request_information(case_id: str, payload: InfoRequestCreate):
    supabase = get_supabase_client()
    try:
        # Resolve case_id string to cases.id UUID
        case_res = supabase.table("cases").select("id").eq("case_id", case_id).execute()
        if not case_res.data:
            case_res = supabase.table("cases").select("id").eq("id", case_id).execute()
            if not case_res.data:
                raise HTTPException(status_code=404, detail="Case not found")
        case_uuid = case_res.data[0]["id"]
        
        req_payload = {
            "case_id": case_uuid,
            "doctor_id": payload.doctor_id,
            "worker_id": payload.worker_id,
            "question": payload.question,
            "status": "PENDING"
        }
        
        res = supabase.table("information_requests").insert(req_payload).execute()
        
        # Update case status to indicate a pending request
        supabase.table("cases").update({"status": "UNDER_REVIEW"}).eq("id", case_uuid).execute()
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="DOCTOR",
            actor_name="Assigned Doctor",
            action="INFORMATION_REQUESTED",
            entity_type="information_requests",
            entity_id=res.data[0]["id"]
        )
        
        return {
            "success": True,
            "data": res.data[0],
            "message": "Information request sent successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/cases/{case_id}/information-requests/{request_id}")
def respond_information_request(case_id: str, request_id: str, payload: InfoRequestRespond):
    supabase = get_supabase_client()
    try:
        # Check request exists
        req_res = supabase.table("information_requests").select("*").eq("id", request_id).execute()
        if not req_res.data:
            raise HTTPException(status_code=404, detail="Information request not found")
            
        # Update response
        res = supabase.table("information_requests").update({
            "response": payload.response,
            "status": "RESPONDED",
            "responded_at": datetime.utcnow().isoformat() + "Z"
        }).eq("id", request_id).execute()
        
        # Revert case status to DOCTOR_REVIEW or VOICE_SUBMITTED so doctor can review
        case_res = supabase.table("cases").select("id").eq("case_id", case_id).execute()
        if case_res.data:
            case_uuid = case_res.data[0]["id"]
            supabase.table("cases").update({"status": "DOCTOR_REVIEW"}).eq("id", case_uuid).execute()
            
        log_audit_event(
            case_id=res.data[0]["case_id"],
            actor_type="SYSTEM",
            actor_name="Health Worker",
            action="INFORMATION_RESPONDED",
            entity_type="information_requests",
            entity_id=request_id
        )
        
        return {
            "success": True,
            "data": res.data[0],
            "message": "Information request response submitted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
