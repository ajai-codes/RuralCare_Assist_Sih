from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.sqlalchemy import Base

class Queue(Base):
    __tablename__ = "queue"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True)
    queue_type = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    status = Column(String, default="WAITING", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class QueueToken(Base):
    __tablename__ = "queue_tokens"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True)
    hospital_id = Column(String, ForeignKey("hospitals.id"), nullable=True)
    department = Column(String, nullable=True)
    token_number = Column(String, nullable=False)
    queue_position = Column(Integer, nullable=True)
    estimated_wait_minutes = Column(Integer, nullable=True)
    status = Column(String, default="WAITING", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
