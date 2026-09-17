from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from app.services.appointment_service import appointment_service
from app.api.auth_deps import get_current_user, verify_appointment_access

router = APIRouter(prefix="/appointments", tags=["appointments"])

class AppointmentCreate(BaseModel):
    patient_id: Optional[str] = None
    facility_id: Optional[str] = None
    doctor_id: Optional[str] = None
    department: Optional[str] = "General Medicine"
    appointment_date: str
    time_slot: str
    appointment_type: Optional[str] = "In-Person"
    triage_priority: Optional[str] = "Routine"
    case_id: Optional[str] = None
    notes: Optional[str] = None

class AppointmentStatusUpdate(BaseModel):
    status: str

class AppointmentReschedule(BaseModel):
    new_date: str
    new_time_slot: str

@router.get("")
def list_appointments(
    patient_id: Optional[str] = None,
    facility_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    appointment_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    try:
        # If user is a patient, automatically restrict to their patient_id
        if user.get("role") == "patient" and not patient_id:
            patient_id = user.get("id")
        data = appointment_service.list_appointments(patient_id, facility_id, doctor_id, appointment_date)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_appointment(payload: AppointmentCreate, user: dict = Depends(get_current_user)):
    try:
        data_dict = payload.model_dump(exclude_unset=True)
        if user.get("role") == "patient" and not data_dict.get("patient_id"):
            data_dict["patient_id"] = user.get("id")
        data = appointment_service.create_appointment(data_dict)
        return {"success": True, "data": data, "message": "Appointment booked successfully"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{appointment_id}")
def get_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    apt = appointment_service.get_appointment(appointment_id)
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not verify_appointment_access(user["id"], user["role"], apt):
        raise HTTPException(status_code=403, detail="Unauthorized to access this appointment")
    return {"success": True, "data": apt}

@router.get("/{appointment_id}/queue")
def get_queue_status(appointment_id: str):
    data = appointment_service.get_queue_status(appointment_id)
    return {"success": True, "data": data}

@router.put("/{appointment_id}/status")
def update_status(appointment_id: str, payload: AppointmentStatusUpdate, user: dict = Depends(get_current_user)):
    try:
        data = appointment_service.update_status(appointment_id, payload.status)
        return {"success": True, "data": data, "message": f"Appointment status updated to {payload.status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{appointment_id}/check-in")
def check_in_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    try:
        data = appointment_service.check_in_appointment(appointment_id)
        return {"success": True, "data": data, "message": "Patient checked in successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{appointment_id}/no-show")
def mark_no_show(appointment_id: str, user: dict = Depends(get_current_user)):
    try:
        data = appointment_service.mark_no_show(appointment_id)
        return {"success": True, "data": data, "message": "Appointment marked as No-show"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{appointment_id}/reschedule")
def reschedule_appointment(appointment_id: str, payload: AppointmentReschedule, user: dict = Depends(get_current_user)):
    apt = appointment_service.get_appointment(appointment_id)
    if apt and not verify_appointment_access(user["id"], user["role"], apt):
        raise HTTPException(status_code=403, detail="Unauthorized to reschedule this appointment")
    try:
        data = appointment_service.reschedule_appointment(appointment_id, payload.new_date, payload.new_time_slot)
        return {"success": True, "data": data, "message": "Appointment rescheduled successfully"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{appointment_id}")
def cancel_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    apt = appointment_service.get_appointment(appointment_id)
    if apt and not verify_appointment_access(user["id"], user["role"], apt):
        raise HTTPException(status_code=403, detail="Unauthorized to cancel this appointment")
    try:
        data = appointment_service.update_status(appointment_id, "CANCELLED")
        return {"success": True, "data": data, "message": "Appointment cancelled successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
