import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"Connecting to Supabase...")
client = create_client(url, key)

try:
    print("Executing select with count='exact'...")
    res = client.table("patients").select("id", count="exact").execute()
    print(f"Result count: {res.count}")
    print(f"Result data: {res.data}")
except Exception as e:
    print(f"Query failed: {e}")
