import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.database.supabase import get_supabase_client, InMemoryDB
from app.services.appointment_service import appointment_service

class TeleconsultationService:
    @staticmethod
    def list_teleconsultations(patient_id: Optional[str] = None, doctor_id: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            supabase = get_supabase_client()
            query = supabase.table("teleconsultations").select("*")
            if patient_id:
                query = query.eq("patient_id", patient_id)
            if doctor_id:
                query = query.eq("doctor_id", doctor_id)
                
            res = query.execute()
            calls = res.data or []
        except Exception as e:
            print("Supabase teleconsultations query failed, using InMemoryDB fallback:", e)
            calls = InMemoryDB.tables.get("teleconsultations", [])
            if patient_id:
                calls = [c for c in calls if c.get("patient_id") == patient_id]
            if doctor_id:
                calls = [c for c in calls if c.get("doctor_id") == doctor_id]

        # Enrich with patient demographics
        for c in calls:
            if "patients" not in c or not c["patients"]:
                pid = c.get("patient_id")
                matched_p = next((p for p in InMemoryDB.tables.get("patients", []) if p.get("id") == pid or p.get("patient_id") == pid), None)
                if matched_p:
                    c["patients"] = {"name": matched_p.get("name"), "patient_id": matched_p.get("patient_id") or pid, "phone": matched_p.get("phone"), "age": matched_p.get("age"), "gender": matched_p.get("gender")}
                else:
                    c["patients"] = {"name": "Patient", "patient_id": pid or "", "phone": "", "age": 0, "gender": "Unknown"}

        calls.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return calls

    @staticmethod
    def get_teleconsultation(call_id: str) -> Optional[Dict[str, Any]]:
        try:
            supabase = get_supabase_client()
            res = supabase.table("teleconsultations").select("*").eq("id", call_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print("Supabase get_teleconsultation failed, checking InMemoryDB:", e)

        for tc in InMemoryDB.tables.get("teleconsultations", []):
            if tc.get("id") == call_id or tc.get("room_id") == call_id:
                return tc
        return None

    @staticmethod
    def get_by_room_id(room_id: str) -> Optional[Dict[str, Any]]:
        try:
            supabase = get_supabase_client()
            res = supabase.table("teleconsultations").select("*").eq("room_id", room_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print("Supabase get_by_room_id failed, checking InMemoryDB:", e)

        for tc in InMemoryDB.tables.get("teleconsultations", []):
            if tc.get("room_id") == room_id or tc.get("id") == room_id:
                return tc
        return None

    @staticmethod
    def create_teleconsultation(data: Dict[str, Any]) -> Dict[str, Any]:
        room_id = data.get("room_id") or f"room-{uuid.uuid4().hex[:7]}"
        apt_id = data.get("appointment_id")
        case_id = data.get("case_id")

        if apt_id and not case_id:
            apt = appointment_service.get_appointment(apt_id)
            if apt:
                case_id = apt.get("case_id")

        new_call = {
            "id": f"TC-{uuid.uuid4().hex[:6].upper()}",
            "appointment_id": apt_id,
            "case_id": case_id,
            "patient_id": data.get("patient_id", "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"),
            "doctor_id": data.get("doctor_id", "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7"),
            "facility_id": data.get("facility_id", "550e8400-e29b-41d4-a716-446655440000"),
            "room_id": room_id,
            "status": "REQUESTED",
            "consultation_notes": data.get("consultation_notes", ""),
            "duration_seconds": 0,
            "scheduled_at": data.get("scheduled_at") or datetime.utcnow().isoformat() + "Z",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "patients": {"name": "Patient", "patient_id": data.get("patient_id", ""), "phone": "", "age": 0, "gender": "Unknown"},
            "profiles": {"full_name": "Dr. Ramesh Kumar", "role": "doctor"}
        }

        try:
            supabase = get_supabase_client()
            res = supabase.table("teleconsultations").insert(new_call).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            print("Supabase create_teleconsultation failed, saving to InMemoryDB:", e)
            InMemoryDB.tables.setdefault("teleconsultations", []).append(new_call)

        return new_call

    @staticmethod
    def update_status(call_id: str, status: str, duration_seconds: Optional[int] = None) -> Dict[str, Any]:
        update_data: Dict[str, Any] = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
        
        tc = TeleconsultationService.get_teleconsultation(call_id)
        apt_id = tc.get("appointment_id") if tc else None

        if status == "IN_PROGRESS":
            update_data["started_at"] = datetime.utcnow().isoformat() + "Z"
            # Synchronize linked appointment status
            if apt_id:
                try:
                    appointment_service.update_status(apt_id, "In Consultation")
                except Exception as ex:
                    print("Failed to sync appointment status to In Consultation:", ex)

        elif status == "COMPLETED":
            update_data["ended_at"] = datetime.utcnow().isoformat() + "Z"
            if duration_seconds is not None:
                update_data["duration_seconds"] = duration_seconds
            elif tc and tc.get("started_at"):
                try:
                    start_dt = datetime.fromisoformat(tc["started_at"].replace("Z", ""))
                    now_dt = datetime.utcnow()
                    update_data["duration_seconds"] = max(1, int((now_dt - start_dt).total_seconds()))
                except Exception:
                    update_data["duration_seconds"] = 60

            # Synchronize linked appointment status to Completed
            if apt_id:
                try:
                    appointment_service.update_status(apt_id, "Completed")
                except Exception as ex:
                    print("Failed to sync appointment status to Completed:", ex)

        try:
            supabase = get_supabase_client()
            res = supabase.table("teleconsultations").update(update_data).eq("id", call_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print("Supabase update teleconsultation status failed, updating InMemoryDB:", e)

        for item in InMemoryDB.tables.get("teleconsultations", []):
            if item.get("id") == call_id or item.get("room_id") == call_id:
                item.update(update_data)
                return item

        return {"id": call_id, "status": status, **update_data}

    @staticmethod
    def add_notes(call_id: str, notes: str, clinical_priority: Optional[str] = None, priority_reason: Optional[str] = None) -> Dict[str, Any]:
        update_data: Dict[str, Any] = {
            "consultation_notes": notes,
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
        if clinical_priority:
            update_data["clinical_priority"] = clinical_priority
        if priority_reason:
            update_data["priority_reason"] = priority_reason

        tc = TeleconsultationService.get_teleconsultation(call_id)
        apt_id = tc.get("appointment_id") if tc else None

        # Sync clinical priority to linked appointment if provided
        if clinical_priority and apt_id:
            try:
                supabase = get_supabase_client()
                supabase.table("appointments").update({"triage_priority": clinical_priority}).eq("id", apt_id).execute()
            except Exception as ex:
                for a in InMemoryDB.tables.get("appointments", []):
                    if a.get("id") == apt_id:
                        a["triage_priority"] = clinical_priority

        try:
            supabase = get_supabase_client()
            res = supabase.table("teleconsultations").update(update_data).eq("id", call_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print("Supabase add_notes failed, updating InMemoryDB:", e)

        for item in InMemoryDB.tables.get("teleconsultations", []):
            if item.get("id") == call_id or item.get("room_id") == call_id:
                item.update(update_data)
                return item

        return {"id": call_id, "consultation_notes": notes, **update_data}

    @staticmethod
    def reassess_priority(call_id: str, clinical_priority: str, priority_reason: str, doctor_id: Optional[str] = None) -> Dict[str, Any]:
        tc = TeleconsultationService.get_teleconsultation(call_id)
        if not tc:
            raise ValueError("Teleconsultation not found")

        ai_priority = tc.get("ai_priority") or "Routine"
        apt_id = tc.get("appointment_id")
        patient_id = tc.get("patient_id")

        update_data = {
            "clinical_priority": clinical_priority,
            "priority_reason": priority_reason,
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }

        # Update appointment priority to match clinical assessment
        if apt_id:
            try:
                supabase = get_supabase_client()
                supabase.table("appointments").update({"triage_priority": clinical_priority}).eq("id", apt_id).execute()
            except Exception:
                for a in InMemoryDB.tables.get("appointments", []):
                    if a.get("id") == apt_id:
                        a["triage_priority"] = clinical_priority

        # Log audit event
        try:
            from app.services.audit_service import log_audit_event
            log_audit_event(
                case_id=tc.get("case_id") or call_id,
                actor_type="DOCTOR",
                actor_name=doctor_id or "Doctor",
                action="CLINICAL_PRIORITY_REASSESSED",
                entity_type="teleconsultations",
                entity_id=call_id
            )
        except Exception as e:
            print("Audit log notice:", e)

        try:
            supabase = get_supabase_client()
            res = supabase.table("teleconsultations").update(update_data).eq("id", call_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print("Supabase reassess_priority failed, updating InMemoryDB:", e)

        for item in InMemoryDB.tables.get("teleconsultations", []):
            if item.get("id") == call_id or item.get("room_id") == call_id:
                item.update(update_data)
                return item

        return {**tc, **update_data}

teleconsultation_service = TeleconsultationService()

