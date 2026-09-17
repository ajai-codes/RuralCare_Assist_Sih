import os
from dotenv import load_dotenv

# Load environmental variables from .env file
load_dotenv()

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_KEY", ""))
    SUPABASE_SERVICE_KEY: str = SUPABASE_SERVICE_ROLE_KEY
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    
    # LLM Settings (configurable runtime/model)
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    LLM_MODEL: str = os.getenv("LLM_MODEL", os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b"))
    
    # Speech to Text Settings
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", os.getenv("WHISPER_MODEL_SIZE", "tiny"))
    
    # Server configuration
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    # CORS setup
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    # Database and Demo Mode settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() == "true"

    # IVR and Telephony settings
    IVR_MODE: str = os.getenv("IVR_MODE", "demo")
    DEMO_PATIENT_PHONE: str = os.getenv("DEMO_PATIENT_PHONE", "")
    IVR_PROVIDER: str = os.getenv("IVR_PROVIDER", "")
    IVR_PHONE_NUMBER: str = os.getenv("IVR_PHONE_NUMBER", "")
    IVR_PROVIDER_API_KEY: str = os.getenv("IVR_PROVIDER_API_KEY", "")
    IVR_PROVIDER_API_SECRET: str = os.getenv("IVR_PROVIDER_API_SECRET", "")
    IVR_WEBHOOK_SECRET: str = os.getenv("IVR_WEBHOOK_SECRET", "")

settings = Settings()
