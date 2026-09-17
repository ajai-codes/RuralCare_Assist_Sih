import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from app.database.supabase import get_supabase_client, InMemoryDB

class AppointmentService:
    @staticmethod
    def list_appointments(
        patient_id: Optional[str] = None,
        facility_id: Optional[str] = None,
        doctor_id: Optional[str] = None,
        appointment_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        try:
            supabase = get_supabase_client()
            query = supabase.table("appointments").select("*")
            if patient_id:
                query = query.eq("patient_id", patient_id)
            if facility_id:
                query = query.eq("facility_id", facility_id)
            if doctor_id:
                query = query.eq("doctor_id", doctor_id)
            if appointment_date:
                query = query.eq("appointment_date", appointment_date)
                
            res = query.execute()
            appointments = res.data or []
        except Exception as e:
            print("Supabase appointments query failed, using InMemoryDB fallback:", e)
            appointments = InMemoryDB.tables.get("appointments", [])
            if patient_id:
                appointments = [a for a in appointments if a.get("patient_id") == patient_id]
            if facility_id:
                appointments = [a for a in appointments if a.get("facility_id") == facility_id]
            if doctor_id:
                appointments = [a for a in appointments if a.get("doctor_id") == doctor_id]
            if appointment_date:
                appointments = [a for a in appointments if a.get("appointment_date") == appointment_date]

        # Enrich with patient demographics if missing
        for a in appointments:
            if "patients" not in a or not a["patients"]:
                pid = a.get("patient_id")
                matched_p = next((p for p in InMemoryDB.tables.get("patients", []) if p.get("id") == pid or p.get("patient_id") == pid), None)
                if matched_p:
                    a["patients"] = {"name": matched_p.get("name"), "patient_id": matched_p.get("patient_id") or pid, "phone": matched_p.get("phone"), "age": matched_p.get("age"), "gender": matched_p.get("gender")}
                else:
                    a["patients"] = {"name": "Patient", "patient_id": pid or "", "phone": "", "age": 0, "gender": "Unknown"}

        priority_order = {"Emergency": 1, "Urgent": 2, "Routine": 3}
        appointments.sort(key=lambda a: (
            priority_order.get(a.get("triage_priority", "Routine"), 4),
            a.get("queue_number", 999),
            a.get("created_at", "")
        ))
        return appointments

    @staticmethod
    def get_appointment(appointment_id: str) -> Optional[Dict[str, Any]]:
        try:
            supabase = get_supabase_client()
            res = supabase.table("appointments").select("*").eq("id", appointment_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print("Supabase get_appointment failed, checking InMemoryDB:", e)
            
        for apt in InMemoryDB.tables.get("appointments", []):
            if apt.get("id") == appointment_id:
                return apt
        return None

    @staticmethod
    def create_appointment(data: Dict[str, Any]) -> Dict[str, Any]:
        apt_date_str = data.get("appointment_date")
        if apt_date_str:
            try:
                apt_date = datetime.strptime(apt_date_str, "%Y-%m-%d").date()
                if apt_date < date.today():
                    raise ValueError("Cannot book appointments for past dates")
            except ValueError as ve:
                if "past dates" in str(ve):
                    raise ve

        facility_id = data.get("facility_id", "550e8400-e29b-41d4-a716-446655440000")
        doctor_id = data.get("doctor_id", "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7")
        time_slot = data.get("time_slot")

        all_today = AppointmentService.list_appointments(facility_id=facility_id, appointment_date=apt_date_str or str(date.today()))
        if time_slot:
            existing = [a for a in all_today if a.get("time_slot") == time_slot and a.get("status") not in ["CANCELLED", "No-show"]]
            if len(existing) > 0:
                raise ValueError(f"Time slot {time_slot} is already booked for this date")

        next_queue_num = len([a for a in all_today if a.get("status") != "CANCELLED"]) + 1

        new_apt = {
            "id": f"RC-APT-{uuid.uuid4().hex[:6].upper()}",
            "patient_id": data.get("patient_id", "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"),
            "facility_id": facility_id,
            "doctor_id": doctor_id,
            "department": data.get("department", "General Medicine"),
            "appointment_date": apt_date_str or str(date.today()),
            "time_slot": time_slot or "10:30 AM",
            "appointment_type": data.get("appointment_type", "In-Person"),
            "status": "Booked",
            "triage_priority": data.get("triage_priority", "Routine"),
            "queue_number": next_queue_num,
            "estimated_wait_minutes": (next_queue_num - 1) * 10,
            "case_id": data.get("case_id"),
            "notes": data.get("notes", ""),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "patients": {"name": "Patient", "patient_id": data.get("patient_id", ""), "phone": "", "age": 0, "gender": "Unknown"},
            "profiles": {"full_name": "Dr. Ramesh Kumar", "role": "doctor"}
        }

        try:
            supabase = get_supabase_client()
            res = supabase.table("appointments").insert(new_apt).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            print("Supabase insert appointment failed, saving to InMemoryDB:", e)
            InMemoryDB.tables.setdefault("appointments", []).append(new_apt)
            
        return new_apt

    @staticmethod
    def update_status(appointment_id: str, status: str) -> Dict[str, Any]:
        update_data: Dict[str, Any] = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
        if status == "Checked In":
            update_data["checked_in_at"] = datetime.utcnow().isoformat() + "Z"
        elif status == "Completed":
            update_data["completed_at"] = datetime.utcnow().isoformat() + "Z"
        elif status == "CANCELLED":
            update_data["cancelled_at"] = datetime.utcnow().isoformat() + "Z"

        try:
            supabase = get_supabase_client()
            res = supabase.table("appointments").update(update_data).eq("id", appointment_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print("Supabase update_status failed, updating InMemoryDB:", e)

        for apt in InMemoryDB.tables.get("appointments", []):
            if apt.get("id") == appointment_id:
                apt.update(update_data)
                return apt

        return {"id": appointment_id, "status": status}

    @staticmethod
    def check_in_appointment(appointment_id: str) -> Dict[str, Any]:
        return AppointmentService.update_status(appointment_id, "Checked In")

    @staticmethod
    def mark_no_show(appointment_id: str) -> Dict[str, Any]:
        apt = AppointmentService.get_appointment(appointment_id)
        if apt and apt.get("status") == "Completed":
            raise ValueError("Cannot mark an already completed appointment as No-show")
        return AppointmentService.update_status(appointment_id, "No-show")

    @staticmethod
    def reschedule_appointment(appointment_id: str, new_date_str: str, new_time_slot: str) -> Dict[str, Any]:
        try:
            new_date = datetime.strptime(new_date_str, "%Y-%m-%d").date()
            if new_date < date.today():
                raise ValueError("Cannot reschedule appointments to past dates")
        except ValueError as ve:
            if "past dates" in str(ve):
                raise ve

        apt = AppointmentService.get_appointment(appointment_id)
        if not apt:
            raise ValueError("Appointment not found")

        facility_id = apt.get("facility_id", "550e8400-e29b-41d4-a716-446655440000")
        all_new_day = AppointmentService.list_appointments(facility_id=facility_id, appointment_date=new_date_str)
        existing = [a for a in all_new_day if a.get("id") != appointment_id and a.get("time_slot") == new_time_slot and a.get("status") not in ["CANCELLED", "No-show"]]
        if len(existing) > 0:
            raise ValueError(f"Time slot {new_time_slot} is already booked on {new_date_str}")

        next_queue_num = len([a for a in all_new_day if a.get("id") != appointment_id and a.get("status") != "CANCELLED"]) + 1

        update_data = {
            "appointment_date": new_date_str,
            "time_slot": new_time_slot,
            "status": "Booked",
            "queue_number": next_queue_num,
            "estimated_wait_minutes": (next_queue_num - 1) * 10,
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }

        try:
            supabase = get_supabase_client()
            res = supabase.table("appointments").update(update_data).eq("id", appointment_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print("Supabase reschedule_appointment failed, updating InMemoryDB:", e)

        for a in InMemoryDB.tables.get("appointments", []):
            if a.get("id") == appointment_id:
                a.update(update_data)
                return a

        return {**apt, **update_data}

    @staticmethod
    def get_queue_status(appointment_id: str) -> Dict[str, Any]:
        apt = AppointmentService.get_appointment(appointment_id)
        if not apt:
            return {"appointment_id": appointment_id, "queue_number": 1, "currently_serving": 1, "people_ahead": 0, "estimated_wait_minutes": 0, "status": "Booked"}

        all_apts = AppointmentService.list_appointments(
            facility_id=apt.get("facility_id"),
            appointment_date=apt.get("appointment_date")
        )

        active_queue = [a for a in all_apts if a.get("status") in ["Booked", "Checked In", "Waiting", "In Consultation"]]
        in_consult = [a for a in active_queue if a.get("status") == "In Consultation"]
        currently_serving = in_consult[0].get("queue_number", 1) if in_consult else (active_queue[0].get("queue_number", 1) if active_queue else 1)

        my_num = apt.get("queue_number", 1)
        ahead = max(0, my_num - currently_serving)

        return {
            "appointment_id": appointment_id,
            "queue_number": my_num,
            "currently_serving": currently_serving,
            "people_ahead": ahead,
            "estimated_wait_minutes": ahead * 10,
            "status": apt.get("status", "Booked")
        }

appointment_service = AppointmentService()
