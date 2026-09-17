from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services import queue_service

router = APIRouter(prefix="/queue", tags=["queue"])

class QueueCreatePayload(BaseModel):
    case_id: str # UUID
    hospital_id: str # UUID
    department: str

class QueueUpdatePayload(BaseModel):
    status: str

@router.get("/{hospital_id}")
def list_hospital_queue(hospital_id: str):
    try:
        return queue_service.get_queue_by_hospital(hospital_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_queue_token(payload: QueueCreatePayload):
    try:
        token = queue_service.generate_queue_token(payload.case_id, payload.hospital_id, payload.department)
        return {
            "success": True,
            "data": token,
            "message": f"Queue token {token['token_number']} successfully assigned"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{token_id}")
def update_queue_token(token_id: str, payload: QueueUpdatePayload):
    try:
        token = queue_service.update_queue_token(token_id, payload.status)
        return {
            "success": True,
            "data": token,
            "message": f"Queue status updated to {payload.status}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
