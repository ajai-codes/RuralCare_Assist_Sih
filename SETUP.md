# RuralCare AI - Setup & Integration Guide

This guide describes the complete configuration and startup instructions for the **RuralCare AI** hackathon MVP.

---

## 1. Prerequisites

Ensure you have the following software installed locally:
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **Git**
- **Ollama** (optional, for clinical extraction; falls back to demo mock data if offline)

---

## 2. Database Setup (Supabase PostgreSQL)

1. Create a project in your **Supabase Console**.
2. Open the **SQL Editor** in Supabase and run the full contents of [`database/schema.sql`](file:///d:/Hackathon%20projects/RuralCare_AI/database/schema.sql).
3. Run the mock data seed script in [`database/seed.sql`](file:///d:/Hackathon%20projects/RuralCare_AI/database/seed.sql) to populate doctors, hospitals, and patients.
4. Enable Realtime triggers on the tables:
   ```sql
   alter publication supabase_realtime add table cases;
   alter publication supabase_realtime add table queue;
   alter publication supabase_realtime add table pharmacy;
   alter publication supabase_realtime add table prescriptions;
   ```

---

## 3. Local AI Pipeline Configuration

### A. Speech-to-Text (faster-whisper)
The speech-to-text service utilizes the `faster-whisper` runtime library. By default, it uses the `small` English-multilingual model. On first audio upload or API request, the model is automatically downloaded and cached locally.
- Adjust model size (e.g. `tiny`, `base`, `small`, `medium`) in `backend/.env` using the `WHISPER_MODEL_SIZE` variable.

### B. Clinical LLM (Ollama)
1. Install Ollama and start the service:
   ```bash
   ollama serve
   ```
2. Pull the locked model:
   ```bash
   ollama pull qwen2.5:0.5b
   ```
3. If Ollama is running, the backend pings the runtime at `http://localhost:11434`. If it is offline and `DEMO_MODE=true` is enabled, the API fails fast (within 0.5s) and cleanly falls back to realistic clinical mock extractions.

---

## 4. Backend Configuration & Startup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` and fill in the required keys:
   ```env
   # Supabase Keys
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:password@db.your-supabase-project.supabase.co:5432/postgres
   
   # AI Config
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=qwen2.5:0.5b
   WHISPER_MODEL_SIZE=small
   
   # Dev settings
   PORT=8000
   HOST=127.0.0.1
   CORS_ORIGINS=http://localhost:5173
   DEMO_MODE=true
   ```
5. Launch the FastAPI server:
   ```bash
   python -m uvicorn app.main:app --port 8000
   ```

---

## 5. Frontend Configuration & Startup

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` based on `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_BASE_URL=http://localhost:8000
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```

---

## 6. Running Automated End-to-End Tests

Verify backend endpoint routing, schemas, and service integrations using the built-in test suite:
```bash
cd backend
# With virtual environment activated:
python -u tests/verify_endpoints.py
```
**Expected Output:**
```text
GET /health: 200 - {'success': True, 'status': 'ok'}
...
==============================================
 Rural Triage E2E verification: ALL TESTS PASSED!
==============================================
```
