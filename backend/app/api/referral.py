from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from app.services import referral_service
from app.api.auth_deps import get_current_user

router = APIRouter(prefix="/referrals", tags=["referrals"])

class ReferralCreate(BaseModel):
    case_id: str
    patient_id: Optional[str] = None
    referring_doctor_name: Optional[str] = "Dr. On-Duty Specialist"
    target_facility: str
    target_department: Optional[str] = "Cardiology"
    priority: Optional[str] = "Emergency"
    reason: str
    transport_required: Optional[bool] = True
    notes: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

@router.post("")
def create_referral(payload: ReferralCreate, user: dict = Depends(get_current_user)):
    try:
        data = payload.model_dump(exclude_unset=True)
        if user.get("role") == "patient" and not data.get("patient_id"):
            data["patient_id"] = user.get("id")
        ref = referral_service.create_referral(data)
        return {
            "success": True,
            "data": ref,
            "message": f"Referral {ref.get('referral_code')} issued successfully for higher facility care."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
def list_referrals(
    patient_id: Optional[str] = None,
    case_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    try:
        if user.get("role") == "patient" and not patient_id:
            patient_id = user.get("id")
        refs = referral_service.list_referrals(patient_id=patient_id, case_id=case_id)
        return {"success": True, "data": refs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{referral_id}/status")
def update_referral_status(referral_id: str, payload: StatusUpdate, user: dict = Depends(get_current_user)):
    try:
        ref = referral_service.update_referral_status(referral_id, payload.status, payload.notes)
        return {
            "success": True,
            "data": ref,
            "message": f"Referral status updated to {payload.status}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
