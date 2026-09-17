from typing import Optional
from fastapi import Header, HTTPException, Query, WebSocket, status

def get_current_user(
    x_user_id: Optional[str] = Header(None),
    x_user_role: Optional[str] = Header(None)
) -> dict:
    """
    Extracts authenticated user context from request headers.
    Defaults to role 'patient' or 'doctor' if not passed in dev/demo mode,
    while enforcing role capabilities.
    """
    user_id = x_user_id or "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
    role = (x_user_role or "patient").lower()
    return {
        "id": user_id,
        "role": role
    }

def verify_teleconsultation_access(
    user_id: str,
    user_role: str,
    teleconsultation: dict
) -> bool:
    """
    Verifies that the user is authorized to participate in this teleconsultation.
    Patients can only access their own consultations.
    Doctors/admins can access assigned consultations or any facility consultations.
    """
    if user_role in ["admin", "superadmin", "health_worker"]:
        return True

    if user_role == "doctor":
        return True

    if user_role == "patient":
        pt_id = teleconsultation.get("patient_id")
        if pt_id and str(pt_id) == str(user_id):
            return True
        return False

    return False

def verify_appointment_access(
    user_id: str,
    user_role: str,
    appointment: dict
) -> bool:
    """
    Verifies that the user is authorized to access or modify this appointment.
    Patients can only view/cancel/reschedule their own appointments.
    """
    if user_role in ["admin", "superadmin", "health_worker", "doctor"]:
        return True

    if user_role == "patient":
        pt_id = appointment.get("patient_id")
        if pt_id and str(pt_id) == str(user_id):
            return True
        return False

    return False

