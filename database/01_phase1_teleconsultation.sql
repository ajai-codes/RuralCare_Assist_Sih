-- RuralCare AI Phase 1 Database Migration Script
-- Schema additions for Appointments, Teleconsultations, Consultation Notes, and Priority Audits

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Appointments Table
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

-- 2. Teleconsultations Table
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
    ai_priority TEXT,
    clinical_priority TEXT CHECK (clinical_priority IN ('Routine', 'Urgent', 'Emergency', 'ROUTINE', 'URGENT', 'EMERGENCY')),
    priority_reason TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Consultation Notes Table (Explicit audit table for teleconsultations)
CREATE TABLE IF NOT EXISTS consultation_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teleconsultation_id TEXT REFERENCES teleconsultations(id) ON DELETE CASCADE,
    appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT NOT NULL,
    clinical_priority TEXT,
    priority_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_teleconsultations_room_id ON teleconsultations(room_id);
CREATE INDEX IF NOT EXISTS idx_teleconsultations_appointment_id ON teleconsultations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_teleconsultation_id ON consultation_notes(teleconsultation_id);

-- Enable RLS & Policies
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teleconsultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Appointments access policy" ON appointments;
CREATE POLICY "Appointments access policy" ON appointments FOR ALL USING (true);

DROP POLICY IF EXISTS "Teleconsultations access policy" ON teleconsultations;
CREATE POLICY "Teleconsultations access policy" ON teleconsultations FOR ALL USING (true);

DROP POLICY IF EXISTS "Consultation Notes access policy" ON consultation_notes;
CREATE POLICY "Consultation Notes access policy" ON consultation_notes FOR ALL USING (true);
