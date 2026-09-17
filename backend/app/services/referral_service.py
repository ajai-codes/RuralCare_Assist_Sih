import random
import logging
import uuid
from typing import Optional, List, Dict, Any
from app.database.supabase import get_supabase_client, InMemoryDB
from app.services.audit_service import log_audit_event

logger = logging.getLogger("ruralcare.referral")

def generate_referral_code() -> str:
    return f"REF-{random.randint(10000, 99999)}"

def create_referral(data: dict) -> dict:
    supabase = get_supabase_client()
    if not data.get("referral_code"):
        data["referral_code"] = generate_referral_code()
    if not data.get("status"):
        data["status"] = "PENDING"
    if not data.get("referring_doctor_name"):
        data["referring_doctor_name"] = "Dr. On-Duty Specialist"
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

        # Resolve patient_id string to patients.id UUID if needed
        if "patient_id" in data and isinstance(data["patient_id"], str):
            p_res = supabase.table("patients").select("id").eq("patient_id", data["patient_id"]).execute()
            if p_res.data:
                data["patient_id"] = p_res.data[0]["id"]

        res = supabase.table("referrals").insert(data).execute()
        referral = res.data[0] if res.data else data
        
        # Log audit event
        if referral.get("case_id"):
            try:
                log_audit_event(
                    case_id=referral["case_id"],
                    actor_type="DOCTOR",
                    actor_name=referral["referring_doctor_name"],
                    action="REFERRAL_CREATED",
                    entity_type="referrals",
                    entity_id=referral["id"]
                )
                supabase.table("cases").update({"status": "EMERGENCY_ESCALATED"}).eq("id", referral["case_id"]).execute()
            except Exception:
                pass

        return referral
    except Exception as e:
        logger.warning(f"Supabase referrals insert failed ({str(e)}), using InMemoryDB fallback.")
        InMemoryDB.tables.setdefault("referrals", []).append(data)
        return data

def list_referrals(patient_id: Optional[str] = None, case_id: Optional[str] = None) -> list:
    supabase = get_supabase_client()
    try:
        query = supabase.table("referrals").select("*, patients(name, patient_id), cases(case_id, main_complaint, triage_level)")
        if patient_id:
            p_res = supabase.table("patients").select("id").eq("patient_id", patient_id).execute()
            p_uuid = p_res.data[0]["id"] if p_res.data else patient_id
            query = query.eq("patient_id", p_uuid)
        if case_id:
            c_res = supabase.table("cases").select("id").eq("case_id", case_id).execute()
            c_uuid = c_res.data[0]["id"] if c_res.data else case_id
            query = query.eq("case_id", c_uuid)
            
        res = query.order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        logger.warning(f"Supabase referrals list query failed ({str(e)}), using InMemoryDB fallback.")
        refs = InMemoryDB.tables.get("referrals", [])
        if patient_id:
            refs = [r for r in refs if r.get("patient_id") == patient_id]
        if case_id:
            refs = [r for r in refs if r.get("case_id") == case_id]
        return refs

def update_referral_status(referral_id: str, new_status: str, notes: Optional[str] = None) -> dict:
    supabase = get_supabase_client()
    try:
        update_data = {"status": new_status}
        if notes:
            update_data["notes"] = notes
        res = supabase.table("referrals").update(update_data).eq("id", referral_id).execute()
        if not res.data:
            res = supabase.table("referrals").update(update_data).eq("referral_code", referral_id).execute()
        if res.data:
            return res.data[0]
        else:
            raise Exception("No row updated")
    except Exception as e:
        logger.warning(f"Supabase referral status update failed ({str(e)}), updating InMemoryDB.")
        refs = InMemoryDB.tables.get("referrals", [])
        for r in refs:
            if r.get("id") == referral_id or r.get("referral_code") == referral_id:
                r["status"] = new_status
                if notes:
                    r["notes"] = notes
                return r
        dummy = {"id": referral_id, "status": new_status, "notes": notes or ""}
        refs.append(dummy)
        return dummy
