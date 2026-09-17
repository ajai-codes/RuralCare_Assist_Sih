from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.services import prescription_service
from app.database.supabase import get_supabase_client

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])

class MedicineItem(BaseModel):
    id: str
    medicine: str
    dosage: str
    frequency: str
    duration: str
    route: str
    instructions: Optional[str] = None

class PrescriptionPayload(BaseModel):
    case_id: str
    doctor_name: str
    doctor_registration_id: str
    clinical_assessment: Optional[str] = None
    medication: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = "DRAFT"
    prescriptionItems: Optional[List[MedicineItem]] = None

class PrescriptionUpdatePayload(BaseModel):
    medication: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = None
    approval_status: Optional[str] = None

@router.post("")
def create_new_prescription(payload: PrescriptionPayload):
    supabase = get_supabase_client()
    try:
        # Resolve case_id string to cases.id UUID if needed
        case_res = supabase.table("cases").select("id", "case_id").eq("case_id", payload.case_id).execute()
        if not case_res.data:
            case_res = supabase.table("cases").select("id", "case_id").eq("id", payload.case_id).execute()
            if not case_res.data:
                raise HTTPException(status_code=404, detail="Case not found")
        
        case_data = case_res.data[0]
        case_id_str = case_data["case_id"]
        
        # Format payload data for prescription service
        items = []
        if payload.prescriptionItems:
            items = [item.model_dump() for item in payload.prescriptionItems]
        elif payload.medication:
            items = [{
                "id": "1",
                "medicine": payload.medication,
                "dosage": payload.dosage or "",
                "frequency": payload.frequency or "",
                "duration": payload.duration or "",
                "route": "Oral",
                "instructions": payload.instructions or ""
            }]
            
        service_data = {
            "doctor_name": payload.doctor_name,
            "doctor_registration_id": payload.doctor_registration_id,
            "clinical_assessment": payload.clinical_assessment or payload.instructions or "",
            "prescriptionItems": items,
            "instructions": payload.instructions or "",
            "follow_up_date": "",
            "medication": payload.medication,
            "dosage": payload.dosage,
            "frequency": payload.frequency,
            "duration": payload.duration,
            "status": payload.status
        }
        
        res = prescription_service.create_prescription(case_id_str, service_data)
        
        # Sync details to prescription row
        supabase.table("prescriptions").update({
            "medication": payload.medication,
            "dosage": payload.dosage,
            "frequency": payload.frequency,
            "duration": payload.duration,
            "status": payload.status,
            "approval_status": payload.status
        }).eq("id", res["id"]).execute()
        
        # Refresh prescription
        updated_res = supabase.table("prescriptions").select("*").eq("id", res["id"]).execute()
        
        return {
            "success": True,
            "data": updated_res.data[0],
            "message": "Prescription successfully created"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}")
def get_prescription(id: str):
    supabase = get_supabase_client()
    try:
        res = supabase.table("prescriptions").select("*").eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Prescription not found")
        return {
            "success": True,
            "data": res.data[0]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id}")
def update_prescription(id: str, payload: PrescriptionUpdatePayload):
    supabase = get_supabase_client()
    try:
        existing = supabase.table("prescriptions").select("*").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Prescription not found")
            
        data = payload.model_dump(exclude_unset=True)
        if "status" in data:
            data["approval_status"] = data["status"]
        elif "approval_status" in data:
            data["status"] = data["approval_status"]
            
        res = supabase.table("prescriptions").update(data).eq("id", id).execute()
        return {
            "success": True,
            "data": res.data[0],
            "message": "Prescription successfully updated"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{id}/approve")
def approve_prescription_endpoint(id: str):
    try:
        res = prescription_service.approve_prescription(id)
        return {
            "success": True,
            "data": res,
            "message": "Prescription approved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
