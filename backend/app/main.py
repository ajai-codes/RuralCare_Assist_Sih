import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings

# Import API Routers
from app.api import patient, case, voice, ai, doctor, pharmacy, queue, prescription, ivr, appointment, teleconsultation, signaling, referral, followup

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ruralcare.main")

app = FastAPI(
    title="RuralCare AI Backend",
    description="Backend API for AI-assisted rural healthcare coordination",
    version="2.0.0"
)

# CORS configuration
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")] if settings.CORS_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers with the /api prefix
app.include_router(patient.router, prefix="/api")
app.include_router(case.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(doctor.router, prefix="/api")
app.include_router(pharmacy.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(prescription.router, prefix="/api")
app.include_router(ivr.router, prefix="/api")
app.include_router(appointment.router, prefix="/api")
app.include_router(teleconsultation.router, prefix="/api")
app.include_router(signaling.router, prefix="/api")
app.include_router(referral.router, prefix="/api")
app.include_router(followup.router, prefix="/api")





@app.get("/health")
def health_check():
    """
    Server health status endpoint.
    """
    return {
        "success": True,
        "status": "ok",
        "service": "ruralcare-backend"
    }

@app.get("/health/services")
async def services_health():
    """
    Detailed service dependencies health check.
    """
    import httpx
    from app.database import supabase
    from app.speech import whisper
    
    supabase_status = "connected"
    if supabase.USE_FALLBACK:
        supabase_status = "fallback_in_memory"

    storage_status = "available"
    if supabase.USE_FALLBACK:
        storage_status = "simulated"

    ollama_status = "offline"
    llm_status = "unavailable"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(settings.LLM_BASE_URL.rstrip("/"))
            if res.status_code == 200:
                ollama_status = "connected"
                tags_res = await client.get(f"{settings.LLM_BASE_URL.rstrip('/')}/api/tags")
                if tags_res.status_code == 200:
                    models = [m.get("name") for m in tags_res.json().get("models", [])]
                    if settings.LLM_MODEL in models or any(settings.LLM_MODEL in m for m in models):
                        llm_status = "available"
                    else:
                        llm_status = f"model_{settings.LLM_MODEL}_not_pulled"
                else:
                    llm_status = "available"
    except Exception:
        pass

    whisper_status = "ready" if whisper.HAS_WHISPER else "mock_mode"

    return {
        "api": "healthy",
        "supabase": supabase_status,
        "storage": storage_status,
        "ollama": ollama_status,
        "llm": llm_status,
        "whisper": whisper_status
    }

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting RuralCare AI Backend on {settings.HOST}:{settings.PORT}")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

