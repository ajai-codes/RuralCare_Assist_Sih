import os
import sys
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv(dotenv_path="d:\\Hackathon projects\\RuralCare_AI\\backend\\.env")

# Add backend directory to python path
sys.path.insert(0, "d:\\Hackathon projects\\RuralCare_AI\\backend")

from app.database.supabase import get_supabase_client

print("Initializing Supabase client wrapper...")
supabase = get_supabase_client()

tables = [
    "hospitals",
    "patients",
    "cases",
    "voice_sessions",
    "clinical_summaries",
    "doctor_reviews",
    "prescriptions",
    "queue_tokens",
    "pharmacy_orders",
    "audit_logs"
]

for table in tables:
    try:
        res = supabase.table(table).select("*").limit(1).execute()
        print(f"Table '{table}': SUCCESS (found {len(res.data)} rows)")
    except Exception as e:
        print(f"Table '{table}': FAILED - {str(e)}")
