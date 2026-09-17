from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from app.services import followup_service
from app.api.auth_deps import get_current_user

router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])

class FollowUpCreate(BaseModel):
    case_id: str
    patient_id: Optional[str] = None
    doctor_name: Optional[str] = "Dr. Medical Officer"
    facility_name: Optional[str] = "Madurai Medical College & Hospital"
    follow_up_date: str
    follow_up_time: Optional[str] = "10:00 AM"
    risk_level: Optional[str] = "HIGH"
    reason: str
    notes: Optional[str] = None

class NotesPayload(BaseModel):
    notes: Optional[str] = None

@router.post("")
def create_followup(payload: FollowUpCreate, user: dict = Depends(get_current_user)):
    try:
        data = payload.model_dump(exclude_unset=True)
        if user.get("role") == "patient" and not data.get("patient_id"):
            data["patient_id"] = user.get("id")
        fu = followup_service.create_followup(data)
        mode = fu.get("notification_mode", "SMS_AND_APP")
        notification_note = "SMS reminder queued." if mode == "SMS_AND_APP" else "No phone detected. Printable slip ready."
        return {
            "success": True,
            "data": fu,
            "message": f"High-risk follow-up scheduled for {fu.get('follow_up_date')} at {fu.get('follow_up_time', '10:00 AM')}. ({notification_note})"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
def list_followups(
    patient_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    try:
        if user.get("role") == "patient":
            user_pid = user.get("id")
            if patient_id and str(patient_id) != str(user_pid):
                raise HTTPException(status_code=403, detail="Forbidden: Cannot view another patient's follow-ups.")
            patient_id = patient_id or user_pid
        fus = followup_service.list_followups(patient_id=patient_id, doctor_id=doctor_id)
        return {"success": True, "data": fus}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{followup_id}/slip")
def get_followup_slip(followup_id: str, user: dict = Depends(get_current_user)):
    try:
        slip = followup_service.get_followup_slip(followup_id)
        if not slip:
            raise HTTPException(status_code=404, detail="Follow-up slip not found.")
        # Authorization check
        if user.get("role") == "patient":
            user_pid = user.get("id")
            slip_pid = slip.get("patient_id")
            if slip_pid and str(slip_pid) != str(user_pid):
                raise HTTPException(status_code=403, detail="Forbidden: Cannot view another patient's reminder slip.")
        return {"success": True, "data": slip}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{followup_id}/complete")
def complete_followup(followup_id: str, payload: Optional[NotesPayload] = None, user: dict = Depends(get_current_user)):
    try:
        notes = payload.notes if payload else None
        fu = followup_service.complete_followup(followup_id, notes)
        return {
            "success": True,
            "data": fu,
            "message": "Follow-up marked as completed."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{followup_id}/trigger-reminder")
def trigger_reminder(followup_id: str, user: dict = Depends(get_current_user)):
    try:
        res = followup_service.trigger_reminder(followup_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

