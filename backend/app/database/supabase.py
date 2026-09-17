import logging
import os
import uuid
from datetime import datetime
from supabase import create_client, Client
from app.config.settings import settings

logger = logging.getLogger("ruralcare.supabase")

_supabase_client = None
USE_FALLBACK = False

class QueryResult:
    def __init__(self, data):
        self.data = data

class InMemoryDB:
    # A class level dictionary to store all table data
    tables = {
        "hospitals": [],
        "patients": [],
        "cases": [],
        "voice_sessions": [],
        "clinical_summaries": [],
        "doctor_reviews": [],
        "prescriptions": [],
        "queue_tokens": [],
        "pharmacy_orders": [],
        "audit_logs": [],
        # SIH26133: New feature tables
        "appointments": [],
        "teleconsultations": [],
        "referrals": [],
        "health_records": [],
        "diagnostic_requests": [],
        "diagnostic_results": [],
        "medicine_inventory": [],
        "followups": [],
        "sync_queue": [],
        "record_access_log": [],
        "information_requests": [],
        "profiles": [],
        "pharmacy": []
    }
    initialized = False

    @classmethod
    def seed(cls):
        if cls.initialized:
            return
        
        # Seed hospitals
        cls.tables["hospitals"] = [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Rural Medical Centre",
                "location": "Melur Panchayat, Madurai District",
                "phone": "9443210001",
                "departments": ["General Medicine", "Cardiology", "Pediatrics", "Emergency Medicine"],
                "pharmacy_enabled": True,
                "created_at": "2026-08-23T11:00:00Z"
            },
            {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "name": "Othakadai Community Clinic",
                "location": "East Street, Othakadai, Madurai",
                "phone": "9443210002",
                "departments": ["General Medicine", "Orthopedics", "Ophthalmology"],
                "pharmacy_enabled": True,
                "created_at": "2026-08-23T11:00:00Z"
            }
        ]
        
        # Seed patients
        cls.tables["patients"] = [
            {
                "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                "patient_id": "PA-2410",
                "name": "Selva",
                "age": 42,
                "gender": "Male",
                "phone": "9443218765",
                "hospital_id": "550e8400-e29b-41d4-a716-446655440000",
                "address": "3/142, West Street, Melur Panchayat, Madurai District",
                "emergency_contact": "Meenakshi (Wife) - 9443218766",
                "allergies": "None reported",
                "medical_history": "Mild Hypertension diagnosed 2 years ago",
                "current_medications": "Amlodipine 5mg once daily",
                "created_at": "2026-08-23T11:00:00Z",
                "updated_at": "2026-08-23T11:00:00Z"
            },
            {
                "id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
                "patient_id": "PA-8041",
                "name": "Anitha V.",
                "age": 28,
                "gender": "Female",
                "phone": "9512345678",
                "hospital_id": "550e8400-e29b-41d4-a716-446655440000",
                "address": "28, Main Road, Melur Rural",
                "emergency_contact": "Venkatesh (Father) - 9512345679",
                "allergies": "Penicillin (Severe rash)",
                "medical_history": "None",
                "current_medications": "None",
                "created_at": "2026-08-23T11:00:00Z",
                "updated_at": "2026-08-23T11:00:00Z"
            },
            {
                "id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
                "patient_id": "PA-0914",
                "name": "Kumaran Pillai",
                "age": 67,
                "gender": "Male",
                "phone": "9887766554",
                "hospital_id": "550e8400-e29b-41d4-a716-446655440001",
                "address": "East Street, Othakadai, Madurai",
                "emergency_contact": "Arun Kumaran (Son) - 9887766555",
                "allergies": "Sulfa drugs",
                "medical_history": "Type 2 Diabetes, Osteoarthritis",
                "current_medications": "Metformin 500mg BD",
                "created_at": "2026-08-23T11:00:00Z",
                "updated_at": "2026-08-23T11:00:00Z"
            }
        ]
        
        # Seed cases
        cls.tables["cases"] = [
            {
                "id": "01020304-0506-0708-090a-0b0c0d0e0f10",
                "case_id": "RT-10245",
                "patient_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                "hospital_id": "550e8400-e29b-41d4-a716-446655440000",
                "department": "Cardiology",
                "main_complaint": "நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது. மூச்சு விட ரொம்ப கஷ்டமா இருக்கு.",
                "status": "PHARMACY_PREPARING",
                "ai_priority": "Emergency",
                "final_priority": "Emergency",
                "expected_arrival": "2026-08-23T11:40:00Z",
                "created_at": "2026-08-23T11:00:00Z",
                "updated_at": "2026-08-23T11:00:00Z"
            },
            {
                "id": "02030405-0607-0809-0a0b-0c0d0e0f1011",
                "case_id": "RT-30812",
                "patient_id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
                "hospital_id": "550e8400-e29b-41d4-a716-446655440000",
                "department": "Emergency Medicine",
                "main_complaint": "வலது கை விரல்ல கத்தி பட்டு ஆழமா வெட்டிடுச்சு. ரத்தம் நிக்காம போய்ட்டே இருக்கு.",
                "status": "DOCTOR_REVIEW",
                "ai_priority": "Urgent",
                "final_priority": "Urgent",
                "expected_arrival": "2026-08-23T11:55:00Z",
                "created_at": "2026-08-23T11:05:00Z",
                "updated_at": "2026-08-23T11:05:00Z"
            },
            {
                "id": "03040506-0708-090a-0b0c-0d0e0f101112",
                "case_id": "RT-49122",
                "patient_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
                "hospital_id": "550e8400-e29b-41d4-a716-446655440001",
                "department": "General Medicine",
                "main_complaint": "I have severe pain in my right knee for three days. Difficulty in walking. Also need to check blood pressure.",
                "status": "VOICE_SUBMITTED",
                "ai_priority": "Routine",
                "final_priority": "Routine",
                "expected_arrival": "2026-08-23T12:10:00Z",
                "created_at": "2026-08-23T11:10:00Z",
                "updated_at": "2026-08-23T11:10:00Z"
            }
        ]
        
        # Seed voice_sessions
        cls.tables["voice_sessions"] = [
            {
                "id": str(uuid.uuid4()),
                "case_id": "01020304-0506-0708-090a-0b0c0d0e0f10",
                "audio_path": "patient-audio/RT-10245/recording.webm",
                "transcript": "நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது. மூச்சு விட ரொம்ப கஷ்டமா இருக்கு.",
                "detected_language": "Tamil + English",
                "duration_seconds": 22,
                "created_at": "2026-08-23T11:00:00Z"
            },
            {
                "id": str(uuid.uuid4()),
                "case_id": "02030405-0607-0809-0a0b-0c0d0e0f1011",
                "audio_path": "patient-audio/RT-30812/recording.webm",
                "transcript": "வலது கை விரல்ல கத்தி பட்டு ஆழமா வெட்டிடுச்சு. ரத்தம் நிக்காம போய்ட்டே இருக்கு.",
                "detected_language": "Tamil",
                "duration_seconds": 15,
                "created_at": "2026-08-23T11:05:00Z"
            },
            {
                "id": str(uuid.uuid4()),
                "case_id": "03040506-0708-090a-0b0c-0d0e0f101112",
                "audio_path": "patient-audio/RT-49122/recording.webm",
                "transcript": "I have severe pain in my right knee for three days. Difficulty in walking. Also need to check blood pressure.",
                "detected_language": "English",
                "duration_seconds": 18,
                "created_at": "2026-08-23T11:10:00Z"
            }
        ]
        
        # Seed clinical_summaries
        cls.tables["clinical_summaries"] = [
            {
                "id": str(uuid.uuid4()),
                "case_id": "01020304-0506-0708-090a-0b0c0d0e0f10",
                "symptoms": ["Retrosternal chest pain", "Left shoulder radiation", "Dyspnea"],
                "duration": "Since yesterday night",
                "severity": "High",
                "medical_history": "Mild Hypertension diagnosed 2 years ago",
                "allergies": "None reported",
                "current_medications": "Amlodipine 5mg once daily",
                "summary": "Patient reports retrosternal chest pain radiating to left shoulder starting last night. Associated with mild dyspnea. Medical history of mild hypertension. Highly suggestive of acute coronary syndrome.",
                "ai_priority": "Emergency",
                "ai_confidence": 94,
                "created_at": "2026-08-23T11:00:00Z"
            },
            {
                "id": str(uuid.uuid4()),
                "case_id": "02030405-0607-0809-0a0b-0c0d0e0f1011",
                "symptoms": ["Deep laceration", "Bleeding", "Localized pain"],
                "duration": "30 minutes ago",
                "severity": "Medium",
                "medical_history": "None",
                "allergies": "Penicillin (Severe rash)",
                "current_medications": "None",
                "summary": "Patient reports a deep laceration on the right index finger caused by a knife. Continuous bleeding. No history of bleeding disorders. Tetanus status unknown.",
                "ai_priority": "Urgent",
                "ai_confidence": 91,
                "created_at": "2026-08-23T11:05:00Z"
            },
            {
                "id": str(uuid.uuid4()),
                "case_id": "03040506-0708-090a-0b0c-0d0e0f101112",
                "symptoms": ["Knee pain", "Difficulty walking", "BP screening request"],
                "duration": "3 days",
                "severity": "Low",
                "medical_history": "Type 2 Diabetes, Osteoarthritis",
                "allergies": "Sulfa drugs",
                "current_medications": "Metformin 500mg BD",
                "summary": "Elderly patient complains of right knee joint pain of moderate-to-severe intensity for three days. Inhibiting ambulation. Requests blood pressure review. History of Osteoarthritis and Diabetes.",
                "ai_priority": "Routine",
                "ai_confidence": 95,
                "created_at": "2026-08-23T11:10:00Z"
            }
        ]
        
        # Seed doctor_reviews
        cls.tables["doctor_reviews"] = [
            {
                "id": str(uuid.uuid4()),
                "case_id": "01020304-0506-0708-090a-0b0c0d0e0f10",
                "doctor_name": "Dr. Ramesh Kumar",
                "doctor_registration_id": "REG-87421",
                "corrected_summary": "Confirmed acute chest pain with dyspnea. ST-segment depression noted on local ECG.",
                "clinical_observations": "Vitals stable on arrival. ECG indicates ST-segment depressions in anterior leads. Forwarding to tertiary cardiac center.",
                "final_priority": "Emergency",
                "department": "Cardiology",
                "review_status": "COMPLETED",
                "reviewed_at": "2026-08-23T11:00:00Z"
            }
        ]
        
        # Seed prescriptions
        cls.tables["prescriptions"] = [
            {
                "id": "990e8400-e29b-41d4-a716-446655440000",
                "case_id": "01020304-0506-0708-090a-0b0c0d0e0f10",
                "doctor_name": "Dr. Ramesh Kumar",
                "doctor_registration_id": "REG-87421",
                "clinical_assessment": "Suspected ACS - Acute Coronary Syndrome. Prescribed loading doses.",
                "medicines": [
                    {"id": "1", "medicine": "Aspirin", "dosage": "300mg", "frequency": "Once immediately", "duration": "Stat", "route": "Oral (Chewable)", "instructions": "Chew immediately"},
                    {"id": "2", "medicine": "Clopidogrel", "dosage": "300mg", "frequency": "Once immediately", "duration": "Stat", "route": "Oral", "instructions": "Take with water"},
                    {"id": "3", "medicine": "Atorvastatin", "dosage": "80mg", "frequency": "Night", "duration": "5 days", "route": "Oral", "instructions": "Take after dinner"}
                ],
                "instructions": "Chew aspirin immediately. Refer to cardiologist.",
                "follow_up_date": "2026-08-25",
                "approval_status": "APPROVED",
                "approved_at": "2026-08-23T11:00:00Z",
                "created_at": "2026-08-23T11:00:00Z"
            }
        ]
        
        # Seed queue_tokens
        cls.tables["queue_tokens"] = [
            {
                "id": str(uuid.uuid4()),
                "case_id": "01020304-0506-0708-090a-0b0c0d0e0f10",
                "hospital_id": "550e8400-e29b-41d4-a716-446655440000",
                "department": "Cardiology",
                "token_number": "C-24",
                "queue_position": 1,
                "estimated_wait_minutes": 8,
                "status": "IN_PROGRESS",
                "created_at": "2026-08-23T11:00:00Z",
                "updated_at": "2026-08-23T11:00:00Z"
            }
        ]
        
        # Seed pharmacy_orders
        cls.tables["pharmacy_orders"] = [
            {
                "id": str(uuid.uuid4()),
                "case_id": "01020304-0506-0708-090a-0b0c0d0e0f10",
                "prescription_id": "990e8400-e29b-41d4-a716-446655440000",
                "hospital_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "PREPARING",
                "created_at": "2026-08-23T11:00:00Z",
                "updated_at": "2026-08-23T11:00:00Z"
            }
        ]
        
        today_iso = datetime.utcnow().date().isoformat()
        
        # Seed appointments
        cls.tables["appointments"] = [
            {
                "id": "RC-APT-1001",
                "patient_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                "facility_id": "550e8400-e29b-41d4-a716-446655440000",
                "doctor_id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7",
                "department": "Cardiology",
                "appointment_date": today_iso,
                "time_slot": "10:30 AM",
                "appointment_type": "Teleconsultation",
                "status": "Booked",
                "triage_priority": "Emergency",
                "queue_number": 1,
                "estimated_wait_minutes": 0,
                "case_id": "RT-10245",
                "notes": "Chest pain radiating to shoulder",
                "created_at": f"{today_iso}T09:00:00Z",
                "patients": {"name": "Selva", "patient_id": "PA-2410", "phone": "9443218765", "age": 42, "gender": "Male"},
                "profiles": {"full_name": "Dr. Ramesh Kumar", "role": "doctor"}
            },
            {
                "id": "RC-APT-1002",
                "patient_id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
                "facility_id": "550e8400-e29b-41d4-a716-446655440000",
                "doctor_id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7",
                "department": "Emergency Medicine",
                "appointment_date": today_iso,
                "time_slot": "11:00 AM",
                "appointment_type": "In-Person",
                "status": "Checked In",
                "triage_priority": "Urgent",
                "queue_number": 2,
                "estimated_wait_minutes": 10,
                "case_id": "RT-30812",
                "notes": "Hand laceration and bleeding",
                "created_at": f"{today_iso}T09:30:00Z",
                "patients": {"name": "Anitha V.", "patient_id": "PA-8041", "phone": "9512345678", "age": 28, "gender": "Female"},
                "profiles": {"full_name": "Dr. Ramesh Kumar", "role": "doctor"}
            },
            {
                "id": "RC-APT-1003",
                "patient_id": "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
                "facility_id": "550e8400-e29b-41d4-a716-446655440001",
                "doctor_id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7",
                "department": "General Medicine",
                "appointment_date": today_iso,
                "time_slot": "02:00 PM",
                "appointment_type": "Teleconsultation",
                "status": "Booked",
                "triage_priority": "Routine",
                "queue_number": 3,
                "estimated_wait_minutes": 20,
                "case_id": "RT-49122",
                "notes": "Knee joint pain & BP check",
                "created_at": f"{today_iso}T10:00:00Z",
                "patients": {"name": "Kumaran Pillai", "patient_id": "PA-0914", "phone": "9887766554", "age": 67, "gender": "Male"},
                "profiles": {"full_name": "Dr. Ramesh Kumar", "role": "doctor"}
            }
        ]

        # Seed teleconsultations
        cls.tables["teleconsultations"] = [
            {
                "id": "TC-1001",
                "appointment_id": "RC-APT-1001",
                "case_id": "RT-10245",
                "patient_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                "doctor_id": "d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7",
                "facility_id": "550e8400-e29b-41d4-a716-446655440000",
                "room_id": "room-demo101",
                "status": "REQUESTED",
                "consultation_notes": "",
                "duration_seconds": 0,
                "scheduled_at": f"{today_iso}T10:30:00Z",
                "created_at": f"{today_iso}T09:00:00Z",
                "patients": {"name": "Selva", "patient_id": "PA-2410", "phone": "9443218765", "age": 42, "gender": "Male"},
                "profiles": {"full_name": "Dr. Ramesh Kumar", "role": "doctor"}
            }
        ]

        cls.initialized = True

    @classmethod
    def execute_query(cls, builder):
        cls.seed()
        table_name = builder.table_name
        action = builder.action
        filters = builder.filters
        order_by = builder.order_by
        limit_val = builder.limit_val
        action_data = builder.action_data

        data_list = cls.tables.get(table_name, [])

        if action == 'select':
            filtered_list = []
            for item in data_list:
                match = True
                for col, val in filters:
                    if isinstance(val, tuple):
                        if len(val) == 2 and val[0] in ("lte", "gte", "lt", "gt", "in"):
                            op, target = val
                            if op == "lte" and str(item.get(col) or "") > str(target):
                                match = False
                                break
                            elif op == "gte" and str(item.get(col) or "") < str(target):
                                match = False
                                break
                            elif op == "lt" and str(item.get(col) or "") >= str(target):
                                match = False
                                break
                            elif op == "gt" and str(item.get(col) or "") <= str(target):
                                match = False
                                break
                            elif op == "in" and str(item.get(col)) not in [str(v) for v in target]:
                                match = False
                                break
                        else:
                            if str(item.get(col)) not in [str(v) for v in val]:
                                match = False
                                break
                    else:
                        if str(item.get(col)) != str(val):
                            match = False
                            break
                if match:
                    filtered_list.append(item.copy())
            
            if order_by:
                col, desc = order_by
                def sort_key(x):
                    v = x.get(col)
                    return v if v is not None else ""
                filtered_list.sort(key=sort_key, reverse=desc)

            if limit_val is not None:
                filtered_list = filtered_list[:limit_val]

            return QueryResult(filtered_list)

        elif action == 'insert':
            inserted_items = []
            records_to_insert = action_data if isinstance(action_data, list) else [action_data]
            
            for item in records_to_insert:
                record = item.copy()
                if "id" not in record:
                    record["id"] = str(uuid.uuid4())
                if "created_at" not in record:
                    record["created_at"] = datetime.utcnow().isoformat() + "Z"
                if "updated_at" not in record:
                    record["updated_at"] = datetime.utcnow().isoformat() + "Z"
                data_list.append(record)
                inserted_items.append(record)

            cls.tables[table_name] = data_list
            return QueryResult(inserted_items)

        elif action == 'update':
            updated_items = []
            for item in data_list:
                match = True
                for col, val in filters:
                    if str(item.get(col)) != str(val):
                        match = False
                        break
                if match:
                    if isinstance(action_data, dict):
                        item.update(action_data)
                        item["updated_at"] = datetime.utcnow().isoformat() + "Z"
                        updated_items.append(item.copy())
            
            return QueryResult(updated_items)

        elif action == 'delete':
            remaining_list = []
            deleted_list = []
            for item in data_list:
                match = True
                for col, val in filters:
                    if str(item.get(col)) != str(val):
                        match = False
                        break
                if match:
                    deleted_list.append(item.copy())
                else:
                    remaining_list.append(item)
            
            cls.tables[table_name] = remaining_list
            return QueryResult(deleted_list)

        return QueryResult([])

class InMemoryQueryBuilder:
    def __init__(self, table_name):
        self.table_name = table_name
        self.action = 'select'
        self.action_data = None
        self.filters = []
        self.order_by = None
        self.limit_val = None

    def select(self, *args, **kwargs):
        self.action = 'select'
        return self

    def insert(self, data):
        self.action = 'insert'
        self.action_data = data
        return self

    def update(self, data):
        self.action = 'update'
        self.action_data = data
        return self

    def delete(self):
        self.action = 'delete'
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def in_(self, column, values):
        self.filters.append((column, ("in", list(values))))
        return self

    def lte(self, column, value):
        self.filters.append((column, ("lte", value)))
        return self

    def gte(self, column, value):
        self.filters.append((column, ("gte", value)))
        return self

    def lt(self, column, value):
        self.filters.append((column, ("lt", value)))
        return self

    def gt(self, column, value):
        self.filters.append((column, ("gt", value)))
        return self

    def or_(self, *args, **kwargs):
        return self

    def order(self, column, desc=True):
        self.order_by = (column, desc)
        return self

    def limit(self, value):
        self.limit_val = value
        return self

    def execute(self):
        return InMemoryDB.execute_query(self)

class FallbackQueryBuilder:
    def __init__(self, real_builder, table_name):
        self.real_builder = real_builder
        self.table_name = table_name
        self.actions = []
        
    def select(self, *args, **kwargs):
        self.actions.append(('select', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.select(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def insert(self, *args, **kwargs):
        self.actions.append(('insert', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.insert(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def update(self, *args, **kwargs):
        self.actions.append(('update', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.update(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def delete(self, *args, **kwargs):
        self.actions.append(('delete', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.delete(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def eq(self, *args, **kwargs):
        self.actions.append(('eq', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.eq(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def in_(self, *args, **kwargs):
        self.actions.append(('in_', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.in_(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def lte(self, *args, **kwargs):
        self.actions.append(('lte', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.lte(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def gte(self, *args, **kwargs):
        self.actions.append(('gte', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.gte(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def lt(self, *args, **kwargs):
        self.actions.append(('lt', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.lt(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def gt(self, *args, **kwargs):
        self.actions.append(('gt', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.gt(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def or_(self, *args, **kwargs):
        self.actions.append(('or_', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.or_(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def order(self, *args, **kwargs):
        self.actions.append(('order', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.order(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def limit(self, *args, **kwargs):
        self.actions.append(('limit', args, kwargs))
        if self.real_builder is not None:
            try:
                self.real_builder = self.real_builder.limit(*args, **kwargs)
            except Exception:
                self.real_builder = None
        return self

    def execute(self):
        global USE_FALLBACK
        if USE_FALLBACK:
            return self._run_in_memory()

        if self.real_builder is not None:
            try:
                res = self.real_builder.execute()
                return res
            except Exception as e:
                logger.warning(f"Database query on table '{self.table_name}' failed ({str(e)}). Falling back to InMemoryDB.")
                return self._run_in_memory()
        else:
            USE_FALLBACK = True
            return self._run_in_memory()


    def _run_in_memory(self):
        mem_builder = InMemoryQueryBuilder(self.table_name)
        for method_name, args, kwargs in self.actions:
            getattr(mem_builder, method_name)(*args, **kwargs)
        return mem_builder.execute()

class FallbackStorageBucket:
    def __init__(self, real_bucket, bucket_name):
        self.real_bucket = real_bucket
        self.bucket_name = bucket_name

    def upload(self, path, file, file_options=None):
        if self.real_bucket is not None:
            try:
                return self.real_bucket.upload(path, file, file_options)
            except Exception as e:
                logger.warning(f"Storage upload to bucket '{self.bucket_name}' failed: {str(e)}. Fallback to simulated upload.")
        return {"path": path}

    def download(self, path):
        if self.real_bucket is not None:
            try:
                return self.real_bucket.download(path)
            except Exception as e:
                logger.warning(f"Storage download from bucket '{self.bucket_name}' failed: {str(e)}. Raising exception to trigger fallback transcription.")
                raise e
        raise Exception("Storage offline")

class FallbackStorage:
    def __init__(self, real_storage):
        self.real_storage = real_storage

    def from_(self, bucket_name):
        real_bucket = None
        if self.real_storage is not None:
            try:
                real_bucket = self.real_storage.from_(bucket_name)
            except Exception:
                pass
        return FallbackStorageBucket(real_bucket, bucket_name)

class FallbackSupabaseClient:
    def __init__(self, real_client):
        self.real_client = real_client
        self.storage = FallbackStorage(getattr(real_client, "storage", None))

    def table(self, table_name):
        real_builder = None
        if self.real_client is not None:
            try:
                real_builder = self.real_client.table(table_name)
            except Exception:
                pass
        return FallbackQueryBuilder(real_builder, table_name)

def get_supabase_client():
    global _supabase_client, USE_FALLBACK
    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY

    if not url or not key:
        logger.warning("Supabase URL or Service Key is not properly set in settings. Fallback mock behaviour may occur.")
        if not url:
            url = "https://placeholder-url.supabase.co"
        if not key:
            key = "placeholder-key"
        USE_FALLBACK = True

    try:
        real_client = create_client(url, key)
        _supabase_client = FallbackSupabaseClient(real_client)
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {str(e)}. Creating fallback mock client.")
        USE_FALLBACK = True
        _supabase_client = FallbackSupabaseClient(None)
        return _supabase_client
