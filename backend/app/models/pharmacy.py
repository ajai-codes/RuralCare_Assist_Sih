from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.sqlalchemy import Base

class Pharmacy(Base):
    __tablename__ = "pharmacy"

    id = Column(String, primary_key=True, index=True)
    pharmacy_name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class PharmacyOrder(Base):
    __tablename__ = "pharmacy_orders"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True)
    prescription_id = Column(String, ForeignKey("prescriptions.id"), nullable=True)
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=True)
    status = Column(String, default="RECEIVED", nullable=False)
    prepared_at = Column(DateTime(timezone=True), nullable=True)
    dispensed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
