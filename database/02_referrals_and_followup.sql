-- RuralCare AI Migration Script: Referrals & High-Risk Follow-Ups
-- Target: Supabase PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. REFERRALS TABLE
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_code TEXT UNIQUE NOT NULL, -- e.g. REF-10025
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    referring_doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    referring_doctor_name TEXT NOT NULL,
    source_facility_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    target_facility TEXT NOT NULL, -- e.g. "Madurai Medical College & Hospital (Tertiary)"
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

-- 2. HIGH-RISK FOLLOW-UPS TABLE
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_patient_id ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_case_id ON referrals(case_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

CREATE INDEX IF NOT EXISTS idx_follow_ups_patient_id ON follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_case_id ON follow_ups(case_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);

-- Enable Row Level Security & Policies
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrals access policy" ON referrals;
CREATE POLICY "Referrals access policy" ON referrals FOR ALL USING (true);

DROP POLICY IF EXISTS "Follow ups access policy" ON follow_ups;
CREATE POLICY "Follow ups access policy" ON follow_ups FOR ALL USING (true);

-- Enable Realtime for referrals & follow-ups in Supabase
alter publication supabase_realtime add table referrals;
alter publication supabase_realtime add table follow_ups;
