import random
import logging
from app.database.supabase import get_supabase_client

logger = logging.getLogger("ruralcare.patient")

def generate_patient_id() -> str:
    number = random.randint(10000, 99999)
    return f"PT-{number}"

def create_patient(data: dict) -> dict:
    supabase = get_supabase_client()
    if not data.get("patient_id"):
        data["patient_id"] = generate_patient_id()
    
    try:
        # Create a database payload excluding transient frontend fields like 'patient_code'
        db_payload = data.copy()
        db_payload.pop("patient_code", None)
        
        # Check if patient exists
        existing = supabase.table("patients").select("*").eq("patient_id", data["patient_id"]).execute()
        if existing.data:
            # Update existing
            response = supabase.table("patients").update(db_payload).eq("patient_id", data["patient_id"]).execute()
        else:
            # Insert new
            response = supabase.table("patients").insert(db_payload).execute()
        
        if not response.data:
            raise Exception("Failed to insert/update patient record")
        return response.data[0]
    except Exception as e:
        logger.error(f"Error in create_patient: {str(e)}")
        raise e

def get_patient_by_id(patient_id: str) -> dict:
    supabase = get_supabase_client()
    try:
        response = supabase.table("patients").select("*").eq("patient_id", patient_id).execute()
        if not response.data:
            try:
                response = supabase.table("patients").select("*").eq("id", patient_id).execute()
            except Exception:
                pass
        if response and response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Error fetching patient {patient_id}: {str(e)}")
        raise e

def update_patient(patient_id: str, updates: dict) -> dict:
    supabase = get_supabase_client()
    try:
        updates.pop("patient_id", None)
        updates.pop("id", None)
        response = supabase.table("patients").update(updates).eq("patient_id", patient_id).execute()
        if not response.data:
            raise Exception(f"Patient with ID {patient_id} not found")
        return response.data[0]
    except Exception as e:
        logger.error(f"Error updating patient {patient_id}: {str(e)}")
        raise e
