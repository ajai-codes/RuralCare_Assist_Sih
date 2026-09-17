-- RuralCare AI Database Schema
-- Target: Supabase PostgreSQL

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to support clean schema re-runs
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS pharmacy_orders CASCADE;
DROP TABLE IF EXISTS queue_tokens CASCADE;
DROP TABLE IF EXISTS queue CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS doctor_reviews CASCADE;
DROP TABLE IF EXISTS clinical_summaries CASCADE;
DROP TABLE IF EXISTS voice_sessions CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS hospitals CASCADE;
DROP TABLE IF EXISTS pharmacy CASCADE;
DROP TABLE IF EXISTS information_requests CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. PROFILES
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'pharmacy', 'admin')),
    facility_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. HOSPITALS
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    departments JSONB, -- JSON list of departments
    pharmacy_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. PATIENTS
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT UNIQUE NOT NULL, -- e.g. PT-10025
    patient_code TEXT UNIQUE, -- e.g. RT-1001 (alias/requested field)
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    preferred_language TEXT DEFAULT 'English' NOT NULL,
    phone TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    address TEXT,
    emergency_contact TEXT,
    allergies TEXT,
    medical_history TEXT,
    current_medications TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. CASES
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id TEXT UNIQUE NOT NULL, -- e.g. RT-10245
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    assigned_doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    department TEXT,
    main_complaint TEXT,
    status TEXT DEFAULT 'CREATED' NOT NULL,
    language TEXT, -- e.g. 'Tamil', 'English', etc.
    audio_path TEXT, -- storage path
    transcript TEXT,
    translation TEXT,
    clinical_summary TEXT,
    triage_level TEXT CHECK (triage_level IN ('EMERGENCY', 'URGENT', 'ROUTINE')),
    triage_confidence NUMERIC,
    triage_factors JSONB, -- JSON array of contributing factors
    ai_priority TEXT,
    final_priority TEXT,
    expected_arrival TIMESTAMP WITH TIME ZONE,
    channel TEXT DEFAULT 'voice_web' NOT NULL,
    caller_phone TEXT,
    location_text TEXT,
    location_source TEXT,
    language_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. VOICE SESSIONS
CREATE TABLE voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    audio_path TEXT NOT NULL,
    transcript TEXT,
    detected_language TEXT,
    duration_seconds NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. CLINICAL SUMMARIES
CREATE TABLE clinical_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    symptoms JSONB, -- JSON array of symptoms
    duration TEXT,
    severity TEXT,
    medical_history TEXT,
    allergies TEXT,
    current_medications TEXT,
    summary TEXT,
    ai_priority TEXT,
    ai_confidence NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. DOCTOR REVIEWS
CREATE TABLE doctor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    doctor_name TEXT,
    doctor_registration_id TEXT,
    corrected_summary TEXT,
    clinical_observations TEXT,
    final_priority TEXT,
    decision TEXT, -- triage level decided
    notes TEXT, -- doctor observations/notes
    department TEXT,
    additional_information_requested TEXT,
    review_status TEXT DEFAULT 'COMPLETED' NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 8. PRESCRIPTIONS
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    doctor_name TEXT NOT NULL,
    doctor_registration_id TEXT NOT NULL,
    clinical_assessment TEXT,
    medicines JSONB NOT NULL, -- JSON array of medicines
    medication TEXT, -- singular medication requested
    dosage TEXT,
    frequency TEXT,
    duration TEXT,
    instructions TEXT,
    status TEXT DEFAULT 'DRAFT' NOT NULL, -- DRAFT, APPROVED, SENT_TO_HOSPITAL
    approval_status TEXT DEFAULT 'DRAFT' NOT NULL, -- DRAFT, APPROVED, SENT_TO_HOSPITAL (existing compatibility)
    approved_at TIMESTAMP WITH TIME ZONE,
    follow_up_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 9. QUEUE
CREATE TABLE queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    queue_type TEXT, -- e.g. department
    priority TEXT, -- priority level (EMERGENCY, URGENT, ROUTINE)
    status TEXT DEFAULT 'WAITING' NOT NULL, -- WAITING, CALLED, COMPLETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);


-- 10. QUEUE TOKENS (Existing compatibility)
CREATE TABLE queue_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    department TEXT,
    token_number TEXT NOT NULL, -- e.g. A-24
    queue_position INTEGER,
    estimated_wait_minutes INTEGER,
    status TEXT DEFAULT 'WAITING' NOT NULL, -- WAITING, CALLED, IN_PROGRESS, COMPLETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 11. PHARMACY
CREATE TABLE pharmacy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_name TEXT NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'active' NOT NULL, -- active, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 12. PHARMACY ORDERS (Existing compatibility)
CREATE TABLE pharmacy_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'RECEIVED' NOT NULL, -- RECEIVED, PREPARING, READY, DISPENSED
    prepared_at TIMESTAMP WITH TIME ZONE,
    dispensed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 13. INFORMATION REQUESTS
CREATE TABLE information_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    worker_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    response TEXT,
    status TEXT DEFAULT 'PENDING' NOT NULL, -- PENDING, RESPONDED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE
);

-- 14. AUDIT LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL, -- PATIENT, AI, DOCTOR, PHARMACIST, SYSTEM
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL, -- CASE_CREATED, VOICE_SUBMITTED, etc.
    entity_type TEXT,
    entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 15. APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    department TEXT DEFAULT 'General Medicine' NOT NULL,
    appointment_date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    appointment_type TEXT DEFAULT 'In-Person' NOT NULL CHECK (appointment_type IN ('In-Person', 'Teleconsultation')),
    status TEXT DEFAULT 'Booked' NOT NULL CHECK (status IN ('Booked', 'Checked In', 'Waiting', 'In Consultation', 'Completed', 'No-show', 'CANCELLED')),
    triage_priority TEXT DEFAULT 'Routine' NOT NULL CHECK (triage_priority IN ('Emergency', 'Urgent', 'Routine')),
    queue_number INTEGER DEFAULT 1 NOT NULL,
    estimated_wait_minutes INTEGER DEFAULT 0 NOT NULL,
    case_id TEXT,
    notes TEXT,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Partial Unique Index for preventing race-condition double bookings
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_slot ON appointments (facility_id, doctor_id, appointment_date, time_slot)
WHERE status != 'CANCELLED';

-- 16. TELECONSULTATIONS
CREATE TABLE IF NOT EXISTS teleconsultations (
    id TEXT PRIMARY KEY,
    appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
    case_id TEXT,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    facility_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    room_id TEXT NOT NULL,
    status TEXT DEFAULT 'REQUESTED' NOT NULL CHECK (status IN ('REQUESTED', 'SCHEDULED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'Failed')),
    consultation_notes TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- INDEXES
CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_hospital_id ON patients(hospital_id);
CREATE INDEX idx_cases_case_id ON cases(case_id);
CREATE INDEX idx_cases_patient_id ON cases(patient_id);
CREATE INDEX idx_cases_hospital_id ON cases(hospital_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_voice_sessions_case_id ON voice_sessions(case_id);
CREATE INDEX idx_clinical_summaries_case_id ON clinical_summaries(case_id);
CREATE INDEX idx_doctor_reviews_case_id ON doctor_reviews(case_id);
CREATE INDEX idx_prescriptions_case_id ON prescriptions(case_id);
CREATE INDEX idx_prescriptions_approval_status ON prescriptions(approval_status);
CREATE INDEX idx_queue_tokens_case_id ON queue_tokens(case_id);
CREATE INDEX idx_queue_tokens_hospital_id ON queue_tokens(hospital_id);
CREATE INDEX idx_pharmacy_orders_case_id ON pharmacy_orders(case_id);
CREATE INDEX idx_pharmacy_orders_prescription_id ON pharmacy_orders(prescription_id);
CREATE INDEX idx_pharmacy_orders_hospital_id ON pharmacy_orders(hospital_id);
CREATE INDEX idx_pharmacy_orders_status ON pharmacy_orders(status);
CREATE INDEX idx_audit_logs_case_id ON audit_logs(case_id);
CREATE INDEX idx_information_requests_case_id ON information_requests(case_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_teleconsultations_room_id ON teleconsultations(room_id);
CREATE INDEX idx_teleconsultations_appointment_id ON teleconsultations(appointment_id);

-- GRANT permissions to Supabase API and service roles
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Enable Realtime for specific tables in Supabase
alter publication supabase_realtime add table cases;
alter publication supabase_realtime add table queue_tokens;
alter publication supabase_realtime add table queue;
alter publication supabase_realtime add table prescriptions;
alter publication supabase_realtime add table pharmacy_orders;
alter publication supabase_realtime add table information_requests;
alter publication supabase_realtime add table appointments;
alter publication supabase_realtime add table teleconsultations;

-- HELPER FUNCTIONS FOR ROW LEVEL SECURITY
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ROW LEVEL SECURITY POLICIES

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read for profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow users to update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow service role insert for profiles" ON profiles FOR INSERT WITH CHECK (true);

-- Patients RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients access policy" ON patients FOR ALL USING (
    get_user_role() IN ('doctor', 'pharmacy', 'admin') OR created_by = auth.uid()
);

-- Cases RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cases access policy" ON cases FOR ALL USING (
    get_user_role() IN ('doctor', 'pharmacy', 'admin') OR patient_id IN (SELECT id FROM patients WHERE created_by = auth.uid())
);

-- Voice Sessions RLS
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voice Sessions access policy" ON voice_sessions FOR ALL USING (
    get_user_role() IN ('doctor', 'pharmacy', 'admin')
);

-- Clinical Summaries RLS
ALTER TABLE clinical_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical Summaries access policy" ON clinical_summaries FOR ALL USING (
    get_user_role() IN ('doctor', 'pharmacy', 'admin')
);

-- Doctor Reviews RLS
ALTER TABLE doctor_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctor Reviews access policy" ON doctor_reviews FOR ALL USING (
    get_user_role() IN ('doctor', 'admin')
);

-- Prescriptions RLS
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prescriptions access policy" ON prescriptions FOR ALL USING (
    get_user_role() IN ('doctor', 'pharmacy', 'admin')
);

-- Queue RLS
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Queue access policy" ON queue FOR ALL USING (true);

-- Queue Tokens RLS
ALTER TABLE queue_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Queue Tokens access policy" ON queue_tokens FOR ALL USING (true);

-- Pharmacy RLS
ALTER TABLE pharmacy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacy access policy" ON pharmacy FOR ALL USING (true);

-- Pharmacy Orders RLS
ALTER TABLE pharmacy_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacy Orders access policy" ON pharmacy_orders FOR ALL USING (
    get_user_role() IN ('doctor', 'pharmacy', 'admin')
);

-- Information Requests RLS
ALTER TABLE information_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Information Requests access policy" ON information_requests FOR ALL USING (
    get_user_role() IN ('doctor', 'admin')
);

-- Audit Logs RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit Logs access policy" ON audit_logs FOR ALL USING (true);

-- Appointments RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Appointments access policy" ON appointments FOR ALL USING (true);

-- Teleconsultations RLS
ALTER TABLE teleconsultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teleconsultations access policy" ON teleconsultations FOR ALL USING (true);

-- 17. REFERRALS
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_code TEXT UNIQUE NOT NULL,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    referring_doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    referring_doctor_name TEXT NOT NULL,
    source_facility_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    target_facility TEXT NOT NULL,
    target_department TEXT DEFAULT 'Cardiology' NOT NULL,
    priority TEXT DEFAULT 'Emergency' NOT NULL CHECK (priority IN ('Emergency', 'Urgent', 'Routine')),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('CREATED', 'PENDING', 'ACCEPTED', 'TRANSFERRED', 'COMPLETED', 'REJECTED')),
    transport_required BOOLEAN DEFAULT TRUE NOT NULL,
    ambulance_status TEXT DEFAULT 'NOT_REQUESTED',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 18. FOLLOW-UPS
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    doctor_name TEXT NOT NULL,
    follow_up_date DATE NOT NULL,
    risk_level TEXT DEFAULT 'HIGH' NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED')),
    reminder_sent BOOLEAN DEFAULT FALSE NOT NULL,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrals access policy" ON referrals FOR ALL USING (true);

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follow ups access policy" ON follow_ups FOR ALL USING (true);

alter publication supabase_realtime add table referrals;
alter publication supabase_realtime add table follow_ups;



