from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.sqlalchemy import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, unique=True, nullable=False, index=True)
    patient_code = Column(String, unique=True, nullable=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    preferred_language = Column(String, default="English", nullable=False)
    phone = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("profiles.id"), nullable=True)
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=True)
    address = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    allergies = Column(String, nullable=True)
    medical_history = Column(String, nullable=True)
    current_medications = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
