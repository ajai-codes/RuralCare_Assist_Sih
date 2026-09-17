from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Numeric, JSON
from sqlalchemy.sql import func
from app.database.sqlalchemy import Base

class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, unique=True, nullable=False, index=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=True)
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=True)
    assigned_doctor_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    department = Column(String, nullable=True)
    main_complaint = Column(String, nullable=True)
    status = Column(String, default="CREATED", nullable=False)
    language = Column(String, nullable=True)
    audio_path = Column(String, nullable=True)
    transcript = Column(String, nullable=True)
    translation = Column(String, nullable=True)
    clinical_summary = Column(String, nullable=True)
    triage_level = Column(String, nullable=True)
    triage_confidence = Column(Numeric, nullable=True)
    triage_factors = Column(JSON, nullable=True)
    ai_priority = Column(String, nullable=True)
    final_priority = Column(String, nullable=True)
    expected_arrival = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class VoiceSession(Base):
    __tablename__ = "voice_sessions"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True)
    audio_path = Column(String, nullable=False)
    transcript = Column(String, nullable=True)
    detected_language = Column(String, nullable=True)
    duration_seconds = Column(Numeric, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ClinicalSummary(Base):
    __tablename__ = "clinical_summaries"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True)
    symptoms = Column(JSON, nullable=True)
    duration = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    medical_history = Column(String, nullable=True)
    allergies = Column(String, nullable=True)
    current_medications = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    ai_priority = Column(String, nullable=True)
    ai_confidence = Column(Numeric, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class InformationRequest(Base):
    __tablename__ = "information_requests"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True)
    doctor_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    worker_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    question = Column(String, nullable=False)
    response = Column(String, nullable=True)
    status = Column(String, default="PENDING", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)
