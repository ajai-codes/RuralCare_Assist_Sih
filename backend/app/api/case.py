from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services import case_service

router = APIRouter(prefix="/cases", tags=["cases"])

class CaseCreate(BaseModel):
    case_id: Optional[str] = None
    patient_id: str
    hospital_id: Optional[str] = None
    department: Optional[str] = None
    main_complaint: Optional[str] = None
    status: Optional[str] = "CREATED"
    ai_priority: Optional[str] = None
    final_priority: Optional[str] = None
    expected_arrival: Optional[str] = None
    channel: Optional[str] = "voice_web"
    caller_phone: Optional[str] = None
    location_text: Optional[str] = None
    location_source: Optional[str] = None
    language_code: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

@router.post("")
def create_new_case(payload: CaseCreate):
    try:
        data = payload.model_dump(exclude_unset=True)
        res = case_service.create_case(data)
        return {
            "success": True,
            "data": res,
            "message": "Clinical case successfully created"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
def list_cases(patient_id: Optional[str] = Query(None)):
    try:
        res = case_service.list_all_cases(patient_id=patient_id)
        return res # Return raw compiled list as expected by frontend
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{case_id}")
def get_case(case_id: str):
    res = case_service.compile_clinical_case(case_id)
    if not res:
        raise HTTPException(status_code=404, detail="Clinical case not found")
    return res # Return raw compiled case as expected by frontend

@router.put("/{case_id}/status")
def update_status(case_id: str, payload: StatusUpdate):
    try:
        res = case_service.update_case_status(case_id, payload.status)
        return {
            "success": True,
            "data": res,
            "message": f"Case status updated to {payload.status}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
