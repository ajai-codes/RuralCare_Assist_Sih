import random
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from app.services import patient_service
from app.database.supabase import get_supabase_client
from app.api.auth_deps import get_current_user

router = APIRouter(tags=["patients"])

class PatientCreate(BaseModel):
    patient_id: Optional[str] = None
    patient_code: Optional[str] = None
    name: str = Field(..., min_length=1)
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = None
    preferred_language: Optional[str] = "English"
    phone: Optional[str] = None
    hospital_id: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None
    current_medications: Optional[str] = None

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = None
    preferred_language: Optional[str] = None
    phone: Optional[str] = None
    hospital_id: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None
    current_medications: Optional[str] = None

def generate_patient_code() -> str:
    supabase = get_supabase_client()
    try:
        res = supabase.table("patients").select("id", count="exact").execute()
        count = res.count or 0
    except Exception:
        count = random.randint(1, 100)
    return f"RT-{1001 + count}"

@router.post("/patients")
@router.post("/patient")
def create_patient(payload: PatientCreate):
    try:
        data = payload.model_dump()
        res = patient_service.create_patient(data)
        if res:
            res["patient_code"] = res.get("patient_id")
        return {
            "success": True,
            "data": res,
            "message": "Patient profile successfully created"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create patient: {str(e)}")

@router.get("/patients")
def list_patients(limit: int = 50, offset: int = 0):
    try:
        patients = patient_service.list_patients(limit=limit, offset=offset)
        return {
            "success": True,
            "data": patients,
            "total": len(patients)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list patients: {str(e)}")

@router.get("/patients/{patient_id}")
@router.get("/patient/{patient_id}")
def get_patient(patient_id: str):
    res = patient_service.get_patient_by_id(patient_id)
    if not res:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    res["patient_code"] = res.get("patient_id")
    return {
        "success": True,
        "data": res
    }

@router.put("/patient/{patient_id}")
@router.put("/patients/{patient_id}")
def update_patient(patient_id: str, payload: PatientUpdate):
    try:
        data = payload.model_dump(exclude_unset=True)
        res = patient_service.update_patient(patient_id, data)
        if res:
            res["patient_code"] = res.get("patient_id")
        return {
            "success": True,
            "data": res,
            "message": "Patient profile successfully updated"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update patient: {str(e)}")

@router.get("/patients/{patient_id}/history")
@router.get("/patient/{patient_id}/history")
def get_patient_longitudinal_history(patient_id: str, user: dict = Depends(get_current_user)):
    """
    Compiles the full Longitudinal Patient Record history including all past cases,
    AI pre-triage sessions, doctor reviews, appointments, prescriptions, referrals, and follow-ups.
    Enforces server-side authorization so patients can only view their own history.
    """
    from app.database.supabase import InMemoryDB
    supabase = get_supabase_client()
    try:
        # 1. Server-side Authorization Check
        user_role = user.get("role", "patient")
        user_id = user.get("id", "")
        
        # Resolve patient UUID & profile
        patient_res = supabase.table("patients").select("*").eq("patient_id", patient_id).execute()
        if not patient_res.data:
            patient_res = supabase.table("patients").select("*").eq("id", patient_id).execute()
        if patient_res.data:
            patient_data = patient_res.data[0]
        else:
            patient_data = {
                "id": patient_id,
                "patient_id": patient_id,
                "name": "Patient",
                "age": 0,
                "gender": "Unknown",
                "phone": "",
                "medical_history": "None reported",
                "allergies": "None reported",
                "current_medications": "None"
            }
        patient_uuid = patient_data.get("id")

        # Authorization: Patients can only view their own record
        if user_role == "patient":
            allowed_ids = {
                str(patient_uuid),
                str(patient_data.get("patient_id")),
                str(patient_id)
            }
            if str(user_id) not in allowed_ids and str(user_id) != str(patient_id):
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: You are not authorized to view this patient's longitudinal record."
                )

        # 2. Fetch cases (AI Triage + Doctor Validation)
        try:
            cases_res = supabase.table("cases").select("*").eq("patient_id", patient_uuid).order("created_at", desc=True).execute()
            cases = cases_res.data or []
        except Exception:
            cases = [c for c in InMemoryDB.tables.get("cases", []) if c.get("patient_id") in [patient_uuid, patient_id]]

        # 3. Fetch appointments & queue statuses
        try:
            apts_res = supabase.table("appointments").select("*").eq("patient_id", patient_uuid).order("appointment_date", desc=True).execute()
            appointments = apts_res.data or []
        except Exception:
            appointments = [a for a in InMemoryDB.tables.get("appointments", []) if a.get("patient_id") in [patient_uuid, patient_id]]

        # 4. Fetch prescriptions & pharmacy statuses
        try:
            pres_res = supabase.table("prescriptions").select("*, cases(case_id)").order("created_at", desc=True).execute()
            patient_case_ids = [c.get("id") for c in cases]
            prescriptions = [p for p in (pres_res.data or []) if p.get("case_id") in patient_case_ids or p.get("patient_id") in [patient_uuid, patient_id]]
        except Exception:
            prescriptions = [p for p in InMemoryDB.tables.get("prescriptions", []) if p.get("patient_id") in [patient_uuid, patient_id] or p.get("case_id") in [c.get("id") for c in cases]]

        # 5. Fetch referrals
        try:
            refs_res = supabase.table("referrals").select("*").eq("patient_id", patient_uuid).order("created_at", desc=True).execute()
            referrals = refs_res.data or []
        except Exception:
            referrals = [r for r in InMemoryDB.tables.get("referrals", []) if r.get("patient_id") in [patient_uuid, patient_id]]

        # 6. Fetch follow-ups
        try:
            fus_res = supabase.table("follow_ups").select("*").eq("patient_id", patient_uuid).order("follow_up_date", desc=False).execute()
            follow_ups = fus_res.data or []
        except Exception:
            follow_ups = [f for f in InMemoryDB.tables.get("follow_ups", []) if f.get("patient_id") in [patient_uuid, patient_id]]

        # 7. Build integrated chronological timeline events
        timeline_events = []

        for c in cases:
            timeline_events.append({
                "type": "triage",
                "timestamp": c.get("created_at") or c.get("timestamp"),
                "title": f"AI Digital Triage — Case {c.get('case_id', 'N/A')}",
                "ai_priority": c.get("ai_priority") or c.get("triage_priority", "Urgent"),
                "doctor_priority": c.get("final_priority") or c.get("doctor_priority"),
                "symptoms": c.get("main_complaint") or c.get("transcript") or c.get("clinical_summary"),
                "details": c
            })

        for a in appointments:
            timeline_events.append({
                "type": "appointment",
                "timestamp": f"{a.get('appointment_date')} {a.get('time_slot')}",
                "title": f"Appointment & Queue — {a.get('appointment_type', 'Consultation')}",
                "status": a.get("status", "Booked"),
                "queue_number": a.get("queue_number"),
                "department": a.get("department", "General Medicine"),
                "priority": a.get("triage_priority", "Routine"),
                "details": a
            })

        for p in prescriptions:
            timeline_events.append({
                "type": "prescription",
                "timestamp": p.get("created_at"),
                "title": f"Prescription & Pharmacy Processing",
                "status": p.get("pharmacy_status") or p.get("status") or "DISPENSED",
                "doctor": p.get("doctor_name") or "Dr. Anand Sharma",
                "medications": p.get("medications") or [],
                "details": p
            })

        for r in referrals:
            timeline_events.append({
                "type": "referral",
                "timestamp": r.get("created_at"),
                "title": f"Tertiary Referral — {r.get('target_facility') or 'Madurai Medical College'}",
                "status": r.get("status", "PENDING"),
                "code": r.get("referral_code"),
                "reason": r.get("reason"),
                "details": r
            })

        for f in follow_ups:
            timeline_events.append({
                "type": "follow_up",
                "timestamp": f.get("follow_up_date"),
                "title": f"High-Risk Follow-Up ({f.get('risk_level', 'High')} Risk)",
                "status": f.get("status", "PENDING"),
                "reason": f.get("reason"),
                "details": f
            })

        return {
            "success": True,
            "data": {
                "patient": patient_data,
                "cases": cases,
                "appointments": appointments,
                "prescriptions": prescriptions,
                "referrals": referrals,
                "follow_ups": follow_ups,
                "timeline_events": timeline_events,
                "total_encounters": len(cases)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch longitudinal history: {str(e)}")
