import logging
import uuid
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from app.database.supabase import get_supabase_client, InMemoryDB
from app.services.audit_service import log_audit_event

logger = logging.getLogger("ruralcare.followup")

def create_followup(data: dict) -> dict:
    supabase = get_supabase_client()
    if not data.get("status"):
        data["status"] = "PENDING"
    if not data.get("doctor_name"):
        data["doctor_name"] = "Dr. On-Duty Medical Officer"
    if not data.get("risk_level"):
        data["risk_level"] = "HIGH"
    if not data.get("follow_up_time"):
        data["follow_up_time"] = "10:00 AM"
    if not data.get("facility_name"):
        data["facility_name"] = "Madurai Medical College & Hospital (Primary & Tertiary Care)"
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())

    try:
        # Resolve case_id string to cases.id UUID if needed
        if "case_id" in data and isinstance(data["case_id"], str):
            c_res = supabase.table("cases").select("id", "patient_id").eq("case_id", data["case_id"]).execute()
            if not c_res.data:
                c_res = supabase.table("cases").select("id", "patient_id").eq("id", data["case_id"]).execute()
            if c_res.data:
                data["case_id"] = c_res.data[0]["id"]
                if not data.get("patient_id") and c_res.data[0].get("patient_id"):
                    data["patient_id"] = c_res.data[0]["patient_id"]

        # Resolve patient_id & check registered phone number for notification mode
        patient_phone = None
        patient_name = "Selva"
        if "patient_id" in data and isinstance(data["patient_id"], str):
            p_res = supabase.table("patients").select("id, name, phone").eq("patient_id", data["patient_id"]).execute()
            if not p_res.data:
                p_res = supabase.table("patients").select("id, name, phone").eq("id", data["patient_id"]).execute()
            if p_res.data:
                data["patient_id"] = p_res.data[0]["id"]
                patient_phone = p_res.data[0].get("phone")
                patient_name = p_res.data[0].get("name") or patient_name

        # Determine Notification Engine Mode:
        # Case A: Mobile number available -> SMS & App Notification
        # Case B: No mobile number -> Printed Slip Required
        has_phone = bool(patient_phone and str(patient_phone).strip().lower() not in ["n/a", "none", "null", ""])
        if has_phone:
            data["notification_mode"] = "SMS_AND_APP"
            data["reminder_sent"] = True
            data["sms_body"] = (
                f"RuralCare Assist: Your follow-up is scheduled for {data.get('follow_up_date')} "
                f"at {data.get('follow_up_time')}. Please attend as instructed by your doctor."
            )
        else:
            data["notification_mode"] = "PRINTED_SLIP"
            data["reminder_sent"] = False
            data["sms_body"] = None

        res = supabase.table("follow_ups").insert(data).execute()
        followup = res.data[0] if res.data else data
        
        if followup.get("case_id"):
            try:
                log_audit_event(
                    case_id=followup["case_id"],
                    actor_type="DOCTOR",
                    actor_name=followup.get("doctor_name", "Dr. Medical Officer"),
                    action="FOLLOW_UP_SCHEDULED",
                    entity_type="follow_ups",
                    entity_id=followup["id"]
                )
            except Exception:
                pass

        return followup
    except Exception as e:
        logger.warning(f"Supabase follow_ups insert failed ({str(e)}), using InMemoryDB fallback.")
        InMemoryDB.tables.setdefault("follow_ups", []).append(data)
        return data

def list_followups(patient_id: Optional[str] = None, doctor_id: Optional[str] = None) -> list:
    supabase = get_supabase_client()
    try:
        query = supabase.table("follow_ups").select("*, patients(name, patient_id, phone), cases(case_id, main_complaint, triage_level)")
        if patient_id:
            p_res = supabase.table("patients").select("id").eq("patient_id", patient_id).execute()
            if not p_res.data:
                p_res = supabase.table("patients").select("id").eq("id", patient_id).execute()
            p_uuid = p_res.data[0]["id"] if p_res.data else patient_id
            query = query.eq("patient_id", p_uuid)
        if doctor_id:
            query = query.eq("doctor_id", doctor_id)
            
        res = query.order("follow_up_date", desc=False).execute()
        return res.data or []
    except Exception as e:
        logger.warning(f"Supabase follow_ups list query failed ({str(e)}), using InMemoryDB fallback.")
        fus = InMemoryDB.tables.get("follow_ups", [])
        if patient_id:
            fus = [f for f in fus if f.get("patient_id") == patient_id]
        if doctor_id:
            fus = [f for f in fus if f.get("doctor_id") == doctor_id]
        return fus

def get_followup_slip(followup_id: str) -> Optional[dict]:
    supabase = get_supabase_client()
    try:
        res = supabase.table("follow_ups").select("*, patients(name, patient_id, phone, age, gender), cases(case_id, main_complaint)").eq("id", followup_id).execute()
        if res.data:
            fu = res.data[0]
            pt = fu.get("patients") or {}
            cs = fu.get("cases") or {}
            return {
                "id": fu.get("id"),
                "patient_name": pt.get("name") or fu.get("patient_name") or "Patient",
                "patient_id": pt.get("patient_id") or fu.get("patient_id") or "",
                "patient_phone": pt.get("phone") or "N/A (Print Slip Mode)",
                "patient_age_gender": f"{pt.get('age', 0)} yrs / {pt.get('gender', 'Unknown')}",
                "follow_up_date": fu.get("follow_up_date"),
                "follow_up_time": fu.get("follow_up_time", "10:00 AM"),
                "doctor_name": fu.get("doctor_name", "Dr. On-Duty Medical Officer"),
                "facility_name": fu.get("facility_name", "Madurai Medical College & Hospital"),
                "risk_level": fu.get("risk_level", "HIGH"),
                "reason": fu.get("reason", "Post-triage clinical re-assessment"),
                "notes": fu.get("notes", "Please bring your previous prescription and record slip upon arrival."),
                "notification_mode": fu.get("notification_mode", "PRINTED_SLIP"),
                "status": fu.get("status", "PENDING"),
                "printed_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            }
    except Exception as e:
        logger.warning(f"Supabase get_followup_slip failed ({str(e)}), checking InMemoryDB.")

    # Fallback to InMemoryDB
    fus = InMemoryDB.tables.get("follow_ups", [])
    for fu in fus:
        if fu.get("id") == followup_id:
            pt = fu.get("patients") or {}
            return {
                "id": fu.get("id"),
                "patient_name": pt.get("name") or fu.get("patient_name") or "Patient",
                "patient_id": fu.get("patient_id") or pt.get("patient_id") or "",
                "patient_phone": pt.get("phone") or "N/A (Print Slip Mode)",
                "patient_age_gender": f"{pt.get('age', 0)} yrs / {pt.get('gender', 'Unknown')}",
                "follow_up_date": fu.get("follow_up_date", date.today().isoformat()),
                "follow_up_time": fu.get("follow_up_time", "10:00 AM"),
                "doctor_name": fu.get("doctor_name", "Dr. On-Duty Medical Officer"),
                "facility_name": fu.get("facility_name", "Madurai Medical College & Hospital"),
                "risk_level": fu.get("risk_level", "HIGH"),
                "reason": fu.get("reason", "Post-triage clinical re-assessment"),
                "notes": fu.get("notes", "Please bring your previous prescription and record slip upon arrival."),
                "notification_mode": fu.get("notification_mode", "PRINTED_SLIP"),
                "status": fu.get("status", "PENDING"),
                "printed_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            }

    return None

def complete_followup(followup_id: str, notes: Optional[str] = None) -> dict:
    supabase = get_supabase_client()
    try:
        update_data = {
            "status": "COMPLETED",
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
        if notes:
            update_data["notes"] = notes
            
        res = supabase.table("follow_ups").update(update_data).eq("id", followup_id).execute()
        if res.data:
            fu = res.data[0]
            if fu.get("case_id"):
                try:
                    log_audit_event(
                        case_id=fu["case_id"],
                        actor_type="DOCTOR",
                        actor_name=fu.get("doctor_name", "Dr. Medical Officer"),
                        action="FOLLOW_UP_COMPLETED",
                        entity_type="follow_ups",
                        entity_id=fu["id"]
                    )
                except Exception:
                    pass
            return fu
        else:
            raise Exception("No row updated")
    except Exception as e:
        logger.warning(f"Supabase follow-up complete failed ({str(e)}), updating InMemoryDB.")
        fus = InMemoryDB.tables.get("follow_ups", [])
        for f in fus:
            if f.get("id") == followup_id:
                f["status"] = "COMPLETED"
                if notes:
                    f["notes"] = notes
                return f
        dummy = {"id": followup_id, "status": "COMPLETED", "notes": notes or ""}
        fus.append(dummy)
        return dummy

def trigger_reminder(followup_id: str) -> dict:
    supabase = get_supabase_client()
    try:
        res = supabase.table("follow_ups").update({
            "reminder_sent": True,
            "last_reminder_at": datetime.utcnow().isoformat() + "Z"
        }).eq("id", followup_id).execute()
        
        if res.data:
            f_data = res.data[0]
        else:
            raise Exception("No row updated")
    except Exception as e:
        logger.warning(f"Supabase follow-up reminder update failed ({str(e)}), updating InMemoryDB.")
        fus = InMemoryDB.tables.get("follow_ups", [])
        f_data = None
        for f in fus:
            if f.get("id") == followup_id:
                f["reminder_sent"] = True
                f_data = f
                break
        if not f_data:
            f_data = {"id": followup_id, "follow_up_date": date.today().isoformat(), "reminder_sent": True}
            fus.append(f_data)

    mode = f_data.get("notification_mode", "SMS_AND_APP")
    if mode == "PRINTED_SLIP":
        msg = f"Patient has no mobile number. Printable Follow-Up Slip ready for printing for date {f_data.get('follow_up_date')}."
    else:
        msg = f"SMS & Mobile Reminder dispatched for High-Risk Follow-Up on {f_data.get('follow_up_date')}."

    return {
        "success": True,
        "data": f_data,
        "notification": msg
    }

