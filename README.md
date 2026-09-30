# RuralCare Assist

> **AI Assists. Doctor Decides. Hospital Prepares.**

RuralCare AI is an AI-assisted rural healthcare coordination system designed to translate patient voice recordings (Tamil, English, and Tamil-English code-switching) into doctor-verified clinical records, queue tracking tokens, and pharmacy preparation tickets.

---

## Repository Structure

```
ruralcare-ai/
│
├── frontend/          # React + Vite + TypeScript + Tailwind CSS Frontend Dashboards
│
├── backend/           # FastAPI Backend Service
│   └── app/
│       ├── api/       # API routers (Patients, Cases, Voice, AI, Doctor, Pharmacy, Queue)
│       ├── ai/        # Ollama clinical marker extraction & deterministic triage
│       ├── speech/    # faster-whisper Speech-to-Text translation
│       ├── services/  # Case, Prescription, Queue, and Pharmacy synchronization logic
│       ├── database/  # Centralized Supabase client initializer
│       ├── models/    # SQLAlchemy ORM schemas mapping to database
│       └── config/    # settings.py configuration loader
│
├── database/          # Supabase PostgreSQL database schemas & seed files
│   ├── schema.sql
│   └── seed.sql
│
├── docs/              # System architecture diagrams and API specs
│   ├── architecture.md
│   └── api.md
│
├── SETUP.md           # Step-by-step database, AI, backend and frontend setup guide (RECOMMENDED)
└── README.md          # Project setup & run overview (this file)
```

---

## Core System Walkthrough

1. **Patient Registration & Voice Triage**: Patient describes their symptoms in Tamil, English, or Tanglish. `faster-whisper` transcribes the voice recording.
2. **AI Clinical Extraction**: The system invokes local LLM (Ollama/Qwen) with an automated fast connection check to extract 14 clinical markers.
3. **Deterministic Triage**: A Python rules engine categorizes the case (`EMERGENCY`, `URGENT`, `ROUTINE`).
4. **Doctor Review & Rx Drafting**: The doctor views findings, overrides priorities, requests further information if needed, and drafts prescriptions.
5. **Real-time Queue & Pharmacy Forwarding**: On doctor approval, the system updates the case status, generates a queue token, and writes prescription orders to the pharmacy ticket queue in real-time.

---

## Quick Start Instructions

Please refer to the detailed **[`SETUP.md`](file:///d:/Hackathon%20projects/RuralCare_AI/SETUP.md)** for detailed setup instructions.

### 1. Database Setup
Run the SQL definitions in [`database/schema.sql`](file:///d:/Hackathon%20projects/RuralCare_AI/database/schema.sql) and the seed data in [`database/seed.sql`](file:///d:/Hackathon%20projects/RuralCare_AI/database/seed.sql) in your Supabase SQL Editor.

### 2. Backend Startup
```bash
cd backend
python -m venv venv
# Activate virtual environment
venv\Scripts\activate # Windows
# Install dependencies
pip install -r requirements.txt
# Copy environment variables
copy .env.example .env
# Launch FastAPI server
python -m uvicorn app.main:app --port 8000
```

### 3. Frontend Startup
```bash
cd frontend
npm install
npm run dev
```

### 4. Running Verification Tests
To run the automated endpoint verification test suite:
```bash
cd backend
python -u tests/verify_endpoints.py
```
