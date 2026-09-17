import uuid
import logging
from app.database.supabase import get_supabase_client, InMemoryDB

logger = logging.getLogger("ruralcare.audit")

def is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError):
        return False

def log_audit_event(case_id: str, actor_type: str, actor_name: str, action: str, entity_type: str = None, entity_id: str = None) -> dict:
    supabase = get_supabase_client()
    
    target_case_uuid = case_id
    if case_id and not is_valid_uuid(case_id):
        # Resolve string case_id (e.g. RT-10245) to cases.id UUID
        try:
            res = supabase.table("cases").select("id").eq("case_id", case_id).execute()
            if res.data and len(res.data) > 0:
                target_case_uuid = res.data[0]["id"]
            else:
                # Search InMemoryDB if not in Supabase
                matched = next((c for c in InMemoryDB.tables.get("cases", []) if c.get("case_id") == case_id or c.get("id") == case_id), None)
                if matched:
                    target_case_uuid = matched.get("id")
                else:
                    target_case_uuid = None
        except Exception:
            target_case_uuid = None

    payload = {
        "case_id": target_case_uuid,
        "actor_type": actor_type,
        "actor_name": actor_name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id if is_valid_uuid(entity_id) else None
    }
    
    try:
        response = supabase.table("audit_logs").insert(payload).execute()
        if response.data:
            return response.data[0]
    except Exception as e:
        logger.warning(f"Failed to log audit event to Supabase ({str(e)}). Saving to InMemoryDB fallback.")
        InMemoryDB.tables.setdefault("audit_logs", []).append(payload)
        return payload
    return payload

