from sqlalchemy import Column, String, DateTime, ForeignKey, Date, JSON
from sqlalchemy.sql import func
from app.database.sqlalchemy import Base

class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True)
    doctor_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    doctor_name = Column(String, nullable=False)
    doctor_registration_id = Column(String, nullable=False)
    clinical_assessment = Column(String, nullable=True)
    medicines = Column(JSON, nullable=False)
    medication = Column(String, nullable=True)
    dosage = Column(String, nullable=True)
    frequency = Column(String, nullable=True)
    duration = Column(String, nullable=True)
    instructions = Column(String, nullable=True)
    status = Column(String, default="DRAFT", nullable=False)
    approval_status = Column(String, default="DRAFT", nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
