-- RuralCare AI Seed Data
-- Target: Supabase PostgreSQL

-- Clear existing data (optional, run with caution)
-- TRUNCATE audit_logs, pharmacy_orders, queue_tokens, queue, prescriptions, doctor_reviews, clinical_summaries, voice_sessions, cases, patients, hospitals, profiles, pharmacy, information_requests CASCADE;

-- 1. PROFILES
INSERT INTO profiles (id, full_name, role, facility_name)
VALUES
('d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', 'Dr. Ramesh Kumar', 'doctor', 'Rural Medical Centre'),
('b0e77d77-b0e7-b0e7-b0e7-b0e7b0e7b0e7', 'Main Pharmacy', 'pharmacy', 'Rural Medical Centre'),
('ad818777-ad81-ad81-ad81-ad81ad81ad81', 'System Admin', 'admin', 'Rural Medical Centre'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Selva', 'patient', NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. HOSPITALS
INSERT INTO hospitals (id, name, location, phone, departments, pharmacy_enabled)
VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Rural Medical Centre', 'Melur Panchayat, Madurai District', '9443210001', '["General Medicine", "Cardiology", "Pediatrics", "Emergency Medicine"]'::jsonb, TRUE),
('550e8400-e29b-41d4-a716-446655440001', 'Othakadai Community Clinic', 'East Street, Othakadai, Madurai', '9443210002', '["General Medicine", "Orthopedics", "Ophthalmology"]'::jsonb, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. PHARMACY
INSERT INTO pharmacy (id, pharmacy_name, location, status)
VALUES
('40e77d77-40e7-40e7-40e7-40e740e740e7', 'Melur Panchayat Pharmacy', 'Melur Panchayat, Madurai', 'active')
ON CONFLICT (id) DO NOTHING;

-- 4. PATIENTS
INSERT INTO patients (id, patient_id, patient_code, name, age, gender, phone, hospital_id, address, emergency_contact, allergies, medical_history, current_medications, preferred_language)
VALUES
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'PA-2410', 'RT-1001', 'Selva', 42, 'Male', '9443218765', '550e8400-e29b-41d4-a716-446655440000', '3/142, West Street, Melur Panchayat, Madurai District', 'Meenakshi (Wife) - 9443218766', 'None reported', 'Mild Hypertension diagnosed 2 years ago', 'Amlodipine 5mg once daily', 'Tamil'),
('b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'PA-8041', 'RT-1002', 'Anitha V.', 28, 'Female', '9512345678', '550e8400-e29b-41d4-a716-446655440000', '28, Main Road, Melur Rural', 'Venkatesh (Father) - 9512345679', 'Penicillin (Severe rash)', 'None', 'None', 'Tamil'),
('c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f', 'PA-0914', 'RT-1003', 'Kumaran Pillai', 67, 'Male', '9887766554', '550e8400-e29b-41d4-a716-446655440001', 'East Street, Othakadai, Madurai', 'Arun Kumaran (Son) - 9887766555', 'Sulfa drugs', 'Type 2 Diabetes, Osteoarthritis', 'Metformin 500mg BD', 'English')
ON CONFLICT (id) DO NOTHING;

-- 5. CASES
INSERT INTO cases (id, case_id, patient_id, hospital_id, assigned_doctor_id, department, main_complaint, status, language, audio_path, transcript, translation, clinical_summary, triage_level, triage_confidence, triage_factors, ai_priority, final_priority, expected_arrival)
VALUES
('01020304-0506-0708-090a-0b0c0d0e0f10', 'RT-10245', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '550e8400-e29b-41d4-a716-446655440000', 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', 'Cardiology', 'நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது. மூச்சு விட ரொம்ப கஷ்டமா இருக்கு.', 'PHARMACY_PREPARING', 'Tamil + English', 'patient-audio/RT-10245/recording.webm', 'நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது. மூச்சு விட ரொம்ப கஷ்டமா இருக்கு.', 'Chest pain since yesterday night radiating to left shoulder. Severe breathing difficulty.', 'Patient reports acute chest pain with radiating pain to left shoulder since yesterday night. Suggests possible acute coronary syndrome.', 'EMERGENCY', 94, '["Retrosternal chest pain", "Left shoulder radiation", "Dyspnea"]'::jsonb, 'Emergency', 'Emergency', NOW() + INTERVAL '10 minutes'),
('02030405-0607-0809-0a0b-0c0d0e0f1011', 'RT-30812', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', '550e8400-e29b-41d4-a716-446655440000', NULL, 'Emergency Medicine', 'வலது கை விரல்ல கத்தி பட்டு ஆழமா வெட்டிடுச்சு. ரத்தம் நிக்காம போய்ட்டே இருக்கு.', 'DOCTOR_REVIEW', 'Tamil', 'patient-audio/RT-30812/recording.webm', 'வலது கை விரல்ல கத்தி பட்டு ஆழமா வெட்டிடுச்சு. ரத்தம் நிக்காம போய்ட்டே இருக்கு.', 'Cut finger with a knife. Bleeding heavily.', 'Patient reports a deep laceration on the right index finger caused by a knife. Continuous bleeding.', 'URGENT', 91, '["Deep laceration", "Bleeding", "Localized pain"]'::jsonb, 'Urgent', 'Urgent', NOW() + INTERVAL '25 minutes'),
('03040506-0708-090a-0b0c-0d0e0f101112', 'RT-49122', 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f', '550e8400-e29b-41d4-a716-446655440001', NULL, 'General Medicine', 'I have severe pain in my right knee for three days. Difficulty in walking. Also need to check blood pressure.', 'VOICE_SUBMITTED', 'English', 'patient-audio/RT-49122/recording.webm', 'I have severe pain in my right knee for three days. Difficulty in walking. Also need to check blood pressure.', 'I have severe pain in my right knee for three days. Difficulty in walking. Also need to check blood pressure.', 'Elderly patient complains of right knee joint pain of moderate-to-severe intensity for three days. Inhibiting ambulation. Requests blood pressure review.', 'ROUTINE', 95, '["Knee pain", "Difficulty walking", "BP screening request"]'::jsonb, 'Routine', 'Routine', NOW() + INTERVAL '40 minutes')
ON CONFLICT (id) DO NOTHING;

-- 6. VOICE SESSIONS
INSERT INTO voice_sessions (case_id, audio_path, transcript, detected_language, duration_seconds)
VALUES
('01020304-0506-0708-090a-0b0c0d0e0f10', 'patient-audio/RT-10245/recording.webm', 'நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது. மூச்சு விட ரொம்ப கஷ்டமா இருக்கு.', 'Tamil + English', 22),
('02030405-0607-0809-0a0b-0c0d0e0f1011', 'patient-audio/RT-30812/recording.webm', 'வலது கை விரல்ல கத்தி பட்டு ஆழமா வெட்டிடுச்சு. ரத்தம் நிக்காம போய்ட்டே இருக்கு.', 'Tamil', 15),
('03040506-0708-090a-0b0c-0d0e0f101112', 'patient-audio/RT-49122/recording.webm', 'I have severe pain in my right knee for three days. Difficulty in walking. Also need to check blood pressure.', 'English', 18)
ON CONFLICT (id) DO NOTHING;

-- 7. CLINICAL SUMMARIES
INSERT INTO clinical_summaries (case_id, symptoms, duration, severity, medical_history, allergies, current_medications, summary, ai_priority, ai_confidence)
VALUES
('01020304-0506-0708-090a-0b0c0d0e0f10', '["Retrosternal chest pain", "Left shoulder radiation", "Dyspnea"]'::jsonb, 'Since yesterday night', 'High', 'Mild Hypertension diagnosed 2 years ago', 'None reported', 'Amlodipine 5mg once daily', 'Patient reports retrosternal chest pain radiating to left shoulder starting last night. Associated with mild dyspnea. Medical history of mild hypertension. Highly suggestive of acute coronary syndrome.', 'Emergency', 94),
('02030405-0607-0809-0a0b-0c0d0e0f1011', '["Deep laceration", "Bleeding", "Localized pain"]'::jsonb, '30 minutes ago', 'Medium', 'None', 'Penicillin (Severe rash)', 'None', 'Patient reports a deep laceration on the right index finger caused by a knife. Continuous bleeding. No history of bleeding disorders. Tetanus status unknown.', 'Urgent', 91),
('03040506-0708-090a-0b0c-0d0e0f101112', '["Knee pain", "Difficulty walking", "BP screening request"]'::jsonb, '3 days', 'Low', 'Type 2 Diabetes, Osteoarthritis', 'Sulfa drugs', 'Metformin 500mg BD', 'Elderly patient complains of right knee joint pain of moderate-to-severe intensity for three days. Inhibiting ambulation. Requests blood pressure review. History of Osteoarthritis and Diabetes.', 'Routine', 95)
ON CONFLICT (id) DO NOTHING;

-- 8. DOCTOR REVIEWS
INSERT INTO doctor_reviews (case_id, doctor_id, doctor_name, doctor_registration_id, corrected_summary, clinical_observations, final_priority, decision, notes, department, review_status)
VALUES
('01020304-0506-0708-090a-0b0c0d0e0f10', 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', 'Dr. Ramesh Kumar', 'REG-87421', 'Confirmed acute chest pain with dyspnea. ST-segment depression noted on local ECG.', 'Vitals stable on arrival. ECG indicates ST-segment depressions in anterior leads. Forwarding to tertiary cardiac center.', 'Emergency', 'EMERGENCY', 'Vitals stable on arrival. ECG indicates ST-segment depressions.', 'Cardiology', 'COMPLETED')
ON CONFLICT (id) DO NOTHING;

-- 9. PRESCRIPTIONS
INSERT INTO prescriptions (id, case_id, doctor_id, doctor_name, doctor_registration_id, clinical_assessment, medicines, medication, dosage, frequency, duration, instructions, status, approval_status, approved_at)
VALUES
('990e8400-e29b-41d4-a716-446655440000', '01020304-0506-0708-090a-0b0c0d0e0f10', 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', 'Dr. Ramesh Kumar', 'REG-87421', 'Suspected ACS - Acute Coronary Syndrome. Prescribed standard loading doses.',
'[
  {"id": "1", "medicine": "Aspirin", "dosage": "300mg", "frequency": "Once immediately", "duration": "Stat", "route": "Oral (Chewable)", "instructions": "Chew immediately"},
  {"id": "2", "medicine": "Clopidogrel", "dosage": "300mg", "frequency": "Once immediately", "duration": "Stat", "route": "Oral", "instructions": "Take with water"},
  {"id": "3", "medicine": "Atorvastatin", "dosage": "80mg", "frequency": "Night", "duration": "5 days", "route": "Oral", "instructions": "Take after dinner"}
]'::jsonb,
'Aspirin', '300mg', 'Once immediately', 'Stat', 'Chew aspirin immediately. Refer to cardiologist.', 'APPROVED', 'APPROVED', NOW() - INTERVAL '5 minutes')
ON CONFLICT (id) DO NOTHING;

-- 10. QUEUE
INSERT INTO queue (case_id, queue_type, priority, status)
VALUES
('01020304-0506-0708-090a-0b0c0d0e0f10', 'Cardiology', 'EMERGENCY', 'WAITING')
ON CONFLICT (id) DO NOTHING;

-- 11. QUEUE TOKENS
INSERT INTO queue_tokens (case_id, hospital_id, department, token_number, queue_position, estimated_wait_minutes, status)
VALUES
('01020304-0506-0708-090a-0b0c0d0e0f10', '550e8400-e29b-41d4-a716-446655440000', 'Cardiology', 'C-24', 1, 8, 'IN_PROGRESS')
ON CONFLICT (id) DO NOTHING;

-- 12. PHARMACY ORDERS
INSERT INTO pharmacy_orders (case_id, prescription_id, hospital_id, status)
VALUES
('01020304-0506-0708-090a-0b0c0d0e0f10', '990e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'PREPARING')
ON CONFLICT (id) DO NOTHING;

-- 13. INFORMATION REQUESTS
INSERT INTO information_requests (case_id, doctor_id, worker_id, question, response, status, created_at, responded_at)
VALUES
('02030405-0607-0809-0a0b-0c0d0e0f1011', 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', NULL, 'What is the patient''s current oxygen saturation?', 'SpO2 is 98% on room air.', 'RESPONDED', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '5 minutes')
ON CONFLICT (id) DO NOTHING;

-- 14. AUDIT LOGS
INSERT INTO audit_logs (case_id, actor_type, actor_name, action, entity_type, entity_id)
VALUES
('01020304-0506-0708-090a-0b0c0d0e0f10', 'PATIENT', 'Selva', 'CASE_CREATED', 'cases', '01020304-0506-0708-090a-0b0c0d0e0f10'),
('01020304-0506-0708-090a-0b0c0d0e0f10', 'SYSTEM', 'faster-whisper', 'VOICE_SUBMITTED', 'voice_sessions', '01020304-0506-0708-090a-0b0c0d0e0f10'),
('01020304-0506-0708-090a-0b0c0d0e0f10', 'AI', 'Qwen', 'AI_SUMMARY_CREATED', 'clinical_summaries', '01020304-0506-0708-090a-0b0c0d0e0f10'),
('01020304-0506-0708-090a-0b0c0d0e0f10', 'AI', 'Qwen', 'AI_TRIAGE_CREATED', 'clinical_summaries', '01020304-0506-0708-090a-0b0c0d0e0f10'),
('01020304-0506-0708-090a-0b0c0d0e0f10', 'DOCTOR', 'Dr. Ramesh Kumar', 'DOCTOR_REVIEWED_CASE', 'doctor_reviews', '01020304-0506-0708-090a-0b0c0d0e0f10'),
('01020304-0506-0708-090a-0b0c0d0e0f10', 'DOCTOR', 'Dr. Ramesh Kumar', 'PRESCRIPTION_APPROVED', 'prescriptions', '990e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (id) DO NOTHING;

-- 15. APPOINTMENTS
INSERT INTO appointments (id, patient_id, facility_id, doctor_id, department, appointment_date, time_slot, appointment_type, status, triage_priority, queue_number, estimated_wait_minutes, case_id, notes)
VALUES
('RC-APT-1001', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '550e8400-e29b-41d4-a716-446655440000', 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', 'Cardiology', CURRENT_DATE, '10:30 AM', 'Teleconsultation', 'Booked', 'Emergency', 1, 0, 'RT-10245', 'Chest pain radiating to shoulder'),
('RC-APT-1002', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', '550e8400-e29b-41d4-a716-446655440000', 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', 'Emergency Medicine', CURRENT_DATE, '11:00 AM', 'In-Person', 'Checked In', 'Urgent', 2, 10, 'RT-30812', 'Hand laceration and bleeding'),
('RC-APT-1003', 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f', '550e8400-e29b-41d4-a716-446655440001', 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', 'General Medicine', CURRENT_DATE, '02:00 PM', 'Teleconsultation', 'Booked', 'Routine', 3, 20, 'RT-49122', 'Knee joint pain & BP check')
ON CONFLICT (id) DO NOTHING;

-- 16. TELECONSULTATIONS
INSERT INTO teleconsultations (id, appointment_id, case_id, patient_id, doctor_id, facility_id, room_id, status, consultation_notes, scheduled_at)
VALUES
('TC-1001', 'RC-APT-1001', 'RT-10245', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7', '550e8400-e29b-41d4-a716-446655440000', 'room-demo101', 'REQUESTED', '', NOW() + INTERVAL '10 minutes')
ON CONFLICT (id) DO NOTHING;

