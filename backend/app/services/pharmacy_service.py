import logging
from app.database.supabase import get_supabase_client
from app.services.audit_service import log_audit_event

logger = logging.getLogger("ruralcare.pharmacy")

def create_pharmacy_order(case_uuid: str, prescription_uuid: str, hospital_uuid: str) -> dict:
    supabase = get_supabase_client()
    payload = {
        "case_id": case_uuid,
        "prescription_id": prescription_uuid,
        "hospital_id": hospital_uuid,
        "status": "RECEIVED"
    }
    
    try:
        # Clear existing orders to prevent duplicates
        supabase.table("pharmacy_orders").delete().eq("case_id", case_uuid).execute()
        
        response = supabase.table("pharmacy_orders").insert(payload).execute()
        if not response.data:
            raise Exception("Failed to insert pharmacy order")
            
        order = response.data[0]
        
        # Update case status to PHARMACY_PREPARING initially or keep DOCTOR_APPROVED
        supabase.table("cases").update({"status": "PHARMACY_PREPARING"}).eq("id", case_uuid).execute()
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="SYSTEM",
            actor_name="Pharmacy Coordinator",
            action="PHARMACY_ORDER_CREATED",
            entity_type="pharmacy_orders",
            entity_id=order["id"]
        )
        return order
    except Exception as e:
        logger.error(f"Error in create_pharmacy_order: {str(e)}")
        raise e

def list_pharmacy_orders() -> list:
    supabase = get_supabase_client()
    try:
        response = supabase.table("pharmacy_orders").select("*").execute()
        return response.data
    except Exception as e:
        logger.error(f"Error listing pharmacy orders: {str(e)}")
        raise e

def update_pharmacy_order_status(case_id_str: str, status: str) -> dict:
    """
    Updates the pharmacy order status using the case_id (string, e.g. RT-10245)
    and propagates the status change to the cases table.
    """
    supabase = get_supabase_client()
    try:
        # 1. Resolve case_id_str to case UUID
        case_res = supabase.table("cases").select("*").eq("case_id", case_id_str).execute()
        if not case_res.data:
            raise Exception("Case not found")
        case_data = case_res.data[0]
        case_uuid = case_data["id"]
        
        # 2. Map status values and determine timestamps
        db_status = status.upper().strip()
        
        updates = {"status": db_status}
        from datetime import datetime
        now_str = datetime.utcnow().isoformat() + "Z"
        if db_status == "PREPARING":
            updates["prepared_at"] = now_str
            case_status = "PHARMACY_PREPARING"
        elif db_status == "READY":
            case_status = "PHARMACY_READY"
        elif db_status == "DISPENSED":
            updates["dispensed_at"] = now_str
            case_status = "COMPLETED"
        else:
            case_status = "PHARMACY_PREPARING"
            
        # 3. Update pharmacy order
        order_res = supabase.table("pharmacy_orders").update(updates).eq("case_id", case_uuid).execute()
        if not order_res.data:
            raise Exception(f"Pharmacy order not found for case {case_id_str}")
            
        # 4. Update case status
        supabase.table("cases").update({"status": case_status}).eq("id", case_uuid).execute()
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="PHARMACIST",
            actor_name="Hospital Pharmacist",
            action=f"PHARMACY_STATUS_UPDATED_{db_status}",
            entity_type="pharmacy_orders",
            entity_id=order_res.data[0]["id"]
        )
        return order_res.data[0]
    except Exception as e:
        logger.error(f"Error in update_pharmacy_order_status: {str(e)}")
        raise e
