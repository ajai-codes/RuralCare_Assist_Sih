# RuralCare AI API Specifications

Every API response follows a consistent JSON envelope structure.

### Standard Response Envelope
```json
{
  "success": true,
  "data": {},
  "message": "Action completed successfully"
}
```

### Error Response Envelope
```json
{
  "success": false,
  "message": "Error details description..."
}
```

---

## 1. Patients
- **POST `/api/patient`** (Alias: `/api/patients`)
  Registers a new patient profile. Generates a sequential, safe patient code starting with `RT-XXXX` (e.g. `RT-1024`).
- **GET `/api/patient/{patient_code}`** (Alias: `/api/patients/{patient_code}`)
  Retrieves a single patient profile details by patient code (e.g., `RT-1002`).
- **PUT `/api/patient/{patient_code}`** (Alias: `/api/patients/{patient_code}`)
  Updates patient profile details.

---

## 2. Cases
- **POST `/api/cases`**
  Creates a new clinical case stub for a patient. Automatically resolves patient code to database UUID.
- **GET `/api/cases`**
  Lists all clinical cases, including active priorities and status states. Supports optional query filters:
  - `status`: Filter by case status (`CREATED`, `DOCTOR_REVIEW`, `DOCTOR_APPROVED`, etc.)
  - `priority`: Filter by final priority (`EMERGENCY`, `URGENT`, `ROUTINE`)
- **GET `/api/cases/{case_id}`**
  Retrieves a single compiled clinical case representation.

---

## 3. Voice & Speech-to-Text
- **POST `/api/voice/transcribe`**
  Handles transcription of speech recording files.
  - Payload: `{ "case_id": "RT-XXXX", "audio_path": "...", "override_transcript": "..." }`
  - Transcribes voice recordings using `faster-whisper` and synchronizes the results (original transcript, language, audio path) to the `cases` table.

---

## 4. AI Pipelines
- **POST `/api/ai/extract`**
  Extracts 14 core clinical fields (such as complaint, severity, symptoms, onset) from the transcript. Falls back to mock data if Ollama is offline and `DEMO_MODE` is active. Synchronizes the clinical summary to `cases.clinical_summary`.
- **POST `/api/ai/triage`**
  Determines patient priority (`EMERGENCY`, `URGENT`, `ROUTINE`) using deterministic Python rules. Synchronizes the triage level, confidence, and contributing factors directly into the `cases` table.

---

## 5. Doctor Reviews & Prescriptions
- **PUT `/api/doctor/cases/{case_id}/review`**
  Submits doctor clinical observations, assigned department, and priority override.
- **POST `/api/prescriptions`**
  Creates a draft prescription with details like medication, dosage, frequency, and instructions.
- **GET `/api/prescriptions/{prescription_id}`**
  Retrieves prescription details by ID.
- **POST `/api/prescriptions/{prescription_id}/approve`**
  Approves a draft prescription. Sets case status to `DOCTOR_APPROVED`, generates a queue token, and forwards details to the pharmacy order queue.

---

## 6. Information Requests
- **POST `/api/doctor/cases/{case_id}/request-information`**
  Allows a doctor to request additional details (e.g. vital signs) from a triage worker.
- **PUT `/api/doctor/cases/{case_id}/information-requests/{request_id}`**
  Submits a response to a doctor's request for information.

---

## 7. Pharmacy Queue
- **GET `/api/pharmacy/queue`**
  Lists all active pharmacy orders en route to the dispenser.
- **PUT `/api/pharmacy/prescriptions/{prescription_id}/status`**
  Updates the status of a pharmacy order and syncs it with the prescription status (`dispensed`, etc.).

---

## 8. Health Services
- **GET `/health`**
  Fast check for backend API server health.
- **GET `/health/services`**
  Checks connectivity of dependent services (Supabase connection, Storage, Whisper local model, Ollama runtime).
