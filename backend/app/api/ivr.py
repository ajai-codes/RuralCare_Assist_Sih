from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from app.config.settings import settings

router = APIRouter(prefix="/ivr", tags=["ivr"])

class WebhookResponse(BaseModel):
    success: bool
    message: str

@router.get("/config")
def get_ivr_config():
    """
    Get backend IVR configurations for demo mode and display prototype info.
    """
    return {
        "ivr_mode": settings.IVR_MODE,
        "demo_patient_phone": settings.DEMO_PATIENT_PHONE or "+91 XXXXX XXXXX"
    }

@router.post("/webhook/incoming")
async def incoming_call_webhook(request: Request):
    """
    Future telephony provider integration - Incoming call trigger.
    In production, this endpoint receives real webhook calls from the carrier.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
        
    return {
        "success": True,
        "message": "Future telephony provider integration - Call webhook registered",
        "details": body
    }

@router.post("/webhook/audio")
async def incoming_audio_webhook(request: Request):
    """
    Future telephony provider integration - Audio streams webhook.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
        
    return {
        "success": True,
        "message": "Future telephony provider integration - Audio chunk processed",
        "details": body
    }

@router.post("/webhook/status")
async def call_status_webhook(request: Request):
    """
    Future telephony provider integration - Status callbacks (Ringing, Connected, Hangup).
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
        
    return {
        "success": True,
        "message": "Future telephony provider integration - Status webhook updated",
        "details": body
    }

@router.post("/callback")
async def ivr_callback(request: Request):
    """
    Future telephony provider integration - General callbacks/instructions.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
        
    return {
        "success": True,
        "message": "Future telephony provider integration - Callback processed",
        "details": body
    }
