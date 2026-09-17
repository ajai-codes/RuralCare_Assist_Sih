from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database.supabase import get_supabase_client
from app.ai.clinical_extraction import extract_clinical_info
from app.ai.triage import recommend_triage_priority
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/ai", tags=["ai"])

class AIRequest(BaseModel):
    case_id: str

@router.post("/extract")
async def run_extraction(payload: AIRequest):
    supabase = get_supabase_client()
    case_id = payload.case_id
    
    try:
        # Get case
        case_res = supabase.table("cases").select("*").eq("case_id", case_id).execute()
        if not case_res.data:
            raise HTTPException(status_code=404, detail="Case not found")
        case_data = case_res.data[0]
        case_uuid = case_data["id"]
        
        # Get patient
        patient_res = supabase.table("patients").select("*").eq("id", case_data["patient_id"]).execute()
        patient_data = patient_res.data[0] if patient_res.data else {}
        
        # Get voice transcript
        voice_res = supabase.table("voice_sessions").select("*").eq("case_id", case_uuid).execute()
        if not voice_res.data:
            raise HTTPException(status_code=400, detail="No voice session found for this case. Record voice first.")
        transcript = voice_res.data[0]["transcript"]
        
        # Extract clinical info
        extracted = await extract_clinical_info(transcript, patient_data)
        
        summary_payload = {
            "case_id": case_uuid,
            "symptoms": extracted.get("symptoms", []),
            "duration": extracted.get("duration", "Not reported"),
            "severity": extracted.get("severity", "Medium"),
            "medical_history": patient_data.get("medical_history", "None"),
            "allergies": patient_data.get("allergies", "None reported"),
            "current_medications": patient_data.get("current_medications", "None"),
            "summary": extracted.get("clinical_summary", ""),
            "ai_priority": extracted.get("severity", "Medium")
        }
        
        # Delete existing summary to replace it cleanly
        supabase.table("clinical_summaries").delete().eq("case_id", case_uuid).execute()
        
        supabase.table("clinical_summaries").insert(summary_payload).execute()
        
        # Update cases table with clinical summary
        supabase.table("cases").update({
            "clinical_summary": extracted.get("clinical_summary", "")
        }).eq("id", case_uuid).execute()
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="AI",
            actor_name="NLP Engine",
            action="AI_SUMMARY_CREATED",
            entity_type="clinical_summaries",
            entity_id=case_uuid
        )
        
        return {
            "success": True,
            "data": extracted,
            "message": "AI clinical marker extraction completed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@router.post("/triage")
async def run_triage(payload: AIRequest):
    supabase = get_supabase_client()
    case_id = payload.case_id
    
    try:
        # Get case
        case_res = supabase.table("cases").select("*").eq("case_id", case_id).execute()
        if not case_res.data:
            raise HTTPException(status_code=404, detail="Case not found")
        case_data = case_res.data[0]
        case_uuid = case_data["id"]
        
        # Get patient
        patient_res = supabase.table("patients").select("*").eq("id", case_data["patient_id"]).execute()
        patient_data = patient_res.data[0] if patient_res.data else {}
        
        # Get clinical summary
        summary_res = supabase.table("clinical_summaries").select("*").eq("case_id", case_uuid).execute()
        if not summary_res.data:
            raise HTTPException(status_code=400, detail="No clinical summary found. Run extraction first.")
        summary_data = summary_res.data[0]
        
        # Determine triage priority
        triage = await recommend_triage_priority(summary_data, patient_data)
        
        # Update case and clinical summary with recommended priority
        supabase.table("cases").update({
            "status": "DOCTOR_REVIEW",
            "ai_priority": triage["ai_priority"],
            "final_priority": triage["ai_priority"],
            "triage_level": triage["triage_level"],
            "triage_confidence": triage["confidence"],
            "triage_factors": triage["contributing_factors"]
        }).eq("id", case_uuid).execute()
        
        supabase.table("clinical_summaries").update({
            "ai_priority": triage["ai_priority"],
            "ai_confidence": triage["ai_confidence"]
        }).eq("case_id", case_uuid).execute()
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="AI",
            actor_name="Triage Engine",
            action="AI_TRIAGE_CREATED",
            entity_type="cases",
            entity_id=case_uuid
        )
        
        return {
            "success": True,
            "data": triage,
            "message": "AI triage priority determined"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Triage failed: {str(e)}")
