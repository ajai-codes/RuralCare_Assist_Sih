from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from app.services.teleconsultation_service import teleconsultation_service
from app.api.auth_deps import get_current_user, verify_teleconsultation_access

router = APIRouter(prefix="/teleconsultations", tags=["teleconsultations"])

class TeleconsultationCreate(BaseModel):
    appointment_id: Optional[str] = None
    case_id: Optional[str] = None
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None
    facility_id: Optional[str] = None
    room_id: Optional[str] = None
    scheduled_at: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str
    duration_seconds: Optional[int] = None

class NotesUpdate(BaseModel):
    notes: str
    clinical_priority: Optional[str] = None
    priority_reason: Optional[str] = None

class PriorityReassessment(BaseModel):
    clinical_priority: str
    priority_reason: str

@router.get("")
def list_teleconsultations(
    patient_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    try:
        if user.get("role") == "patient" and not patient_id:
            patient_id = user.get("id")
        data = teleconsultation_service.list_teleconsultations(patient_id, doctor_id)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_teleconsultation(payload: TeleconsultationCreate, user: dict = Depends(get_current_user)):
    try:
        data_dict = payload.model_dump(exclude_unset=True)
        if user.get("role") == "patient" and not data_dict.get("patient_id"):
            data_dict["patient_id"] = user.get("id")
        data = teleconsultation_service.create_teleconsultation(data_dict)
        return {"success": True, "data": data, "message": "Teleconsultation room created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{call_id}")
def get_teleconsultation(call_id: str, user: dict = Depends(get_current_user)):
    tc = teleconsultation_service.get_teleconsultation(call_id)
    if not tc:
        raise HTTPException(status_code=404, detail="Teleconsultation not found")
    if not verify_teleconsultation_access(user["id"], user["role"], tc):
        raise HTTPException(status_code=403, detail="Unauthorized to access this consultation")
    return {"success": True, "data": tc}

@router.put("/{call_id}/status")
def update_status(call_id: str, payload: StatusUpdate, user: dict = Depends(get_current_user)):
    try:
        data = teleconsultation_service.update_status(call_id, payload.status, payload.duration_seconds)
        return {"success": True, "data": data, "message": f"Status updated to {payload.status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{call_id}/notes")
def add_notes(call_id: str, payload: NotesUpdate, user: dict = Depends(get_current_user)):
    try:
        data = teleconsultation_service.add_notes(call_id, payload.notes, payload.clinical_priority, payload.priority_reason)
        return {"success": True, "data": data, "message": "Notes saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{call_id}/reassess-priority")
def reassess_priority(call_id: str, payload: PriorityReassessment, user: dict = Depends(get_current_user)):
    if user.get("role") not in ["doctor", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only authorized clinical doctors can reassess patient priority")
    try:
        data = teleconsultation_service.reassess_priority(
            call_id=call_id,
            clinical_priority=payload.clinical_priority,
            priority_reason=payload.priority_reason,
            doctor_id=user.get("id")
        )
        return {"success": True, "data": data, "message": "Clinical priority reassessed and recorded in audit log"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

