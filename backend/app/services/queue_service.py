import random
import logging
from app.database.supabase import get_supabase_client
from app.services.audit_service import log_audit_event

logger = logging.getLogger("ruralcare.queue")

def generate_queue_token(case_uuid: str, hospital_uuid: str, department: str) -> dict:
    """
    Generates a queue token for an approved case, registers it at the hospital, and updates case status.
    """
    supabase = get_supabase_client()
    if not hospital_uuid:
        # If no hospital is assigned, use the default one from the system
        hosp_res = supabase.table("hospitals").select("id").limit(1).execute()
        if hosp_res.data:
            hospital_uuid = hosp_res.data[0]["id"]
        else:
            raise Exception("No hospitals available to assign queue token")

    # Generate token number e.g. M-42 (Melur) or O-15 (Othakadai)
    dept_code = department[0].upper() if department else "G"
    number = random.randint(10, 99)
    token_number = f"{dept_code}-{number}"
    
    try:
        # Determine queue position (count existing WAITING/IN_PROGRESS tokens)
        count_res = supabase.table("queue_tokens")\
            .select("id")\
            .eq("hospital_id", hospital_uuid)\
            .eq("department", department)\
            .in_("status", ["WAITING", "IN_PROGRESS"])\
            .execute()
        
        position = len(count_res.data) + 1
        wait_time = position * 10 # 10 minutes per person
        
        payload = {
            "case_id": case_uuid,
            "hospital_id": hospital_uuid,
            "department": department,
            "token_number": token_number,
            "queue_position": position,
            "estimated_wait_minutes": wait_time,
            "status": "WAITING"
        }
        
        # Delete existing tokens for this case if any to prevent duplicates
        supabase.table("queue_tokens").delete().eq("case_id", case_uuid).execute()
        
        response = supabase.table("queue_tokens").insert(payload).execute()
        
        # Sync to queue table
        try:
            supabase.table("queue").delete().eq("case_id", case_uuid).execute()
            case_res = supabase.table("cases").select("final_priority").eq("id", case_uuid).execute()
            priority_val = "ROUTINE"
            if case_res.data and case_res.data[0].get("final_priority"):
                priority_val = case_res.data[0]["final_priority"].upper()
                
            queue_payload = {
                "case_id": case_uuid,
                "queue_type": department or "General Medicine",
                "priority": priority_val,
                "status": "WAITING"
            }
            supabase.table("queue").insert(queue_payload).execute()
        except Exception as q_sync_err:
            logger.warning(f"Failed to sync to queue table: {str(q_sync_err)}")
        if not response.data:
            raise Exception("Failed to insert queue token")
            
        token = response.data[0]
        
        # Update case status to QUEUE_ASSIGNED
        supabase.table("cases").update({"status": "QUEUE_ASSIGNED"}).eq("id", case_uuid).execute()
        
        log_audit_event(
            case_id=case_uuid,
            actor_type="SYSTEM",
            actor_name="Queue Manager",
            action="QUEUE_ASSIGNED",
            entity_type="queue_tokens",
            entity_id=token["id"]
        )
        return token
    except Exception as e:
        logger.error(f"Error in generate_queue_token: {str(e)}")
        raise e

def get_queue_by_hospital(hospital_uuid: str) -> list:
    supabase = get_supabase_client()
    try:
        response = supabase.table("queue_tokens").select("*").eq("hospital_id", hospital_uuid).execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching queue for hospital {hospital_uuid}: {str(e)}")
        raise e

def update_queue_token(token_uuid: str, status: str) -> dict:
    supabase = get_supabase_client()
    try:
        response = supabase.table("queue_tokens").update({"status": status}).eq("id", token_uuid).execute()
        if not response.data:
            raise Exception("Queue token not found")
            
        # Sync to queue table
        try:
            token_data = response.data[0]
            c_uuid = token_data["case_id"]
            q_status = "WAITING"
            if status in ["COMPLETED", "COMPLETED_DISPENSED"]:
                q_status = "COMPLETED"
            elif status in ["CALLED", "IN_PROGRESS"]:
                q_status = "CALLED"
            supabase.table("queue").update({"status": q_status}).eq("case_id", c_uuid).execute()
        except Exception as q_sync_err:
            logger.warning(f"Failed to sync queue update: {str(q_sync_err)}")
        
        token = response.data[0]
        log_audit_event(
            case_id=token["case_id"],
            actor_type="SYSTEM",
            actor_name="Queue Manager",
            action="QUEUE_STATUS_UPDATED",
            entity_type="queue_tokens",
            entity_id=token_uuid
        )
        return token
    except Exception as e:
        logger.error(f"Error updating queue token {token_uuid}: {str(e)}")
        raise e
