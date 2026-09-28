import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError

load_dotenv()

# Get the database URL from environment variables
DATABASE_URL = os.getenv("DATABASE_URL")

# Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a base class for ORM models
Base = declarative_base()

# Import all models to ensure they are registered with SQLAlchemy
# This must be done after Base is defined but before any database operations
def import_models():
    """Import all models to ensure they are registered with SQLAlchemy."""
    try:
        # Import v2 models
        from app.v2.models import (
            MedicalNoteModel,
            PatientModel,
            ProviderModel,
            RoleModel,
            NoteSectionModel,
            TemplateModel,
            FeedbackModel,
            AuditLogModel
        )
        return True
    except ImportError as e:
        print(f"Warning: Could not import some models: {e}")
        return False

# Dependency to get the DB session
def get_db():
    # Ensure models are imported when database is first used
    import_models()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Function to test the database connection
def test_database_connection():
    # Ensure models are imported when testing connection
    import_models()
    try:
        engine.connect()  # pool_pre_ping=True should handle this, but just in case, we'll try to execute a simple query
        return True
    except OperationalError:
        return False