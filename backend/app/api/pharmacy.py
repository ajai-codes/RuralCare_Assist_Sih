from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services import pharmacy_service, case_service
from app.database.supabase import get_supabase_client

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])

class PharmacyStatusUpdate(BaseModel):
    status: str

@router.get("/queue")
def list_pharmacy_queue():
    """
    Returns the list of cases currently in the pharmacy processing queue.
    """
    try:
        all_cases = case_service.list_all_cases()
        # Filter cases that are in pharmacy processing stages (Pharmacy status or Dispensed)
        queue_cases = [c for c in all_cases if c.get("doctorApproved") or c.get("pharmacyStatus") is not None]
        return queue_cases
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cases/{id}")
def get_pharmacy_case(id: str):
    """
    Retrieves case details for pharmacy review.
    """
    res = case_service.compile_clinical_case(id)
    if not res:
        raise HTTPException(status_code=404, detail="Case not found")
    return res

@router.put("/prescriptions/{id}/status")
def update_prescription_status(id: str, payload: PharmacyStatusUpdate):
    """
    Updates the prescription/order status. Resolves prescription ID or Case ID and updates state.
    """
    supabase = get_supabase_client()
    try:
        # Check if ID is a prescription ID
        pres_res = supabase.table("prescriptions").select("case_id").eq("id", id).execute()
        case_id_str = None
        
        if pres_res.data:
            case_uuid = pres_res.data[0]["case_id"]
            case_res = supabase.table("cases").select("case_id").eq("id", case_uuid).execute()
            if case_res.data:
                case_id_str = case_res.data[0]["case_id"]
        else:
            # Check if ID is a case_id (like 'RT-10245') or case UUID
            case_res = supabase.table("cases").select("case_id").eq("case_id", id).execute()
            if case_res.data:
                case_id_str = case_res.data[0]["case_id"]
            else:
                case_res = supabase.table("cases").select("case_id").eq("id", id).execute()
                if case_res.data:
                    case_id_str = case_res.data[0]["case_id"]
                    
        if not case_id_str:
            raise HTTPException(status_code=404, detail="Associated case/prescription not found")
            
        # Update pharmacy order status
        res = pharmacy_service.update_pharmacy_order_status(case_id_str, payload.status)
        
        # Additionally update prescriptions status column
        if pres_res.data:
            supabase.table("prescriptions").update({
                "status": payload.status.upper(),
                "approval_status": payload.status.upper()
            }).eq("id", id).execute()
            
        return {
            "success": True,
            "data": res,
            "message": f"Pharmacy prescription status updated to {payload.status}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Keep existing endpoints for backward compatibility
@router.get("/cases")
def list_pharmacy_cases():
    try:
        all_cases = case_service.list_all_cases()
        pharmacy_cases = [c for c in all_cases if c.get("doctorApproved")]
        return pharmacy_cases
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prescriptions")
def list_prescriptions():
    supabase = get_supabase_client()
    try:
        res = supabase.table("prescriptions").select("*").execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/orders/{case_id}/status")
def update_order_status(case_id: str, payload: PharmacyStatusUpdate):
    try:
        res = pharmacy_service.update_pharmacy_order_status(case_id, payload.status)
        return {
            "success": True,
            "data": res,
            "message": f"Pharmacy order status updated to {payload.status}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MedicationSafetyRequest(BaseModel):
    medicines: list

@router.post("/medication-safety")
def evaluate_medication_safety_endpoint(payload: MedicationSafetyRequest):
    """
    Evaluates prescribed medicines for active pharmaceutical ingredients (API),
    duplicate API warnings, and drug-drug interactions.
    """
    from app.services.medication_service import evaluate_medication_safety
    try:
        res = evaluate_medication_safety(payload.medicines)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Medication safety evaluation failed: {str(e)}")

