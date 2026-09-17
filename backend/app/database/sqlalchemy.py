import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("ruralcare.sqlalchemy")

# Use DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

engine = None
SessionLocal = None

if DATABASE_URL:
    try:
        # Support sslmode requirement for Supabase in SQLAlchemy if needed
        # (Supabase connection pooler usually needs it, pool_pre_ping checks connection liveness)
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logger.info("SQLAlchemy connection engine initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize SQLAlchemy engine with DATABASE_URL: {str(e)}")
else:
    logger.warning("DATABASE_URL environment variable is not set. SQLAlchemy ORM is unconfigured.")

Base = declarative_base()

def get_db():
    if SessionLocal is None:
        raise ConnectionError("SQLAlchemy Database connection is not configured or offline. Set DATABASE_URL in .env.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
