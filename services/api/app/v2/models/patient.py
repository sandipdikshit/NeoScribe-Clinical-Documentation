from datetime import date, datetime
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, Date, String, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from sqlalchemy.orm import Session, relationship
from pydantic import BaseModel, Field, Extra, validator

from app.v2.models.note import MedicalNoteCRUD

from app.database import Base
import os 
from sqlalchemy.exc import SQLAlchemyError

# SQLAlchemy Model
class PatientModel(Base):
    """
    Represents a patient in the database.

    Attributes:
        patient_id (UUID): Unique identifier for the patient.
        first_name (str): First name of the patient.
        last_name (str): Last name of the patient.
        date_of_birth (date): Date of birth of the patient.
        gender (str): Gender of the patient.
        created_at (datetime): Timestamp when the patient record was created.
        updated_at (datetime): Timestamp when the patient record was last updated.
        medical_notes (relationship): Relationship to the medical notes associated with the patient.
    """
    __tablename__ = "patients_v2"
    __table_args__ = {'schema': f'{os.getenv("DATABASE_SCHEMA")}'}
    patient_id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider_id = Column(Integer, ForeignKey(f"{os.getenv('DATABASE_SCHEMA')}.users.iUserId", ondelete="CASCADE"), nullable=False)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(50), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    #relationships
    medical_notes = relationship("MedicalNoteModel", back_populates="patients")
    provider = relationship("ProviderModel", back_populates="patients")

    @property
    def full_name(self) -> str:
        """
        Returns the full name of the patient.

        Returns:
            str: Full name in the format "FirstName LastName".
        """
        return f"{self.first_name} {self.last_name}"
    
    @property
    def age(self) -> int:
        """
        Calculates the age of the patient.

        Returns:
            int: Age of the patient in years.
        """
        today = date.today()
        return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))

# Pydantic Schemas
class PatientBase(BaseModel):
    """
    Base schema for patient data.

    Attributes:
        first_name (str): First name of the patient.
        last_name (str): Last name of the patient.
        date_of_birth (date): Date of birth of the patient.
        gender (str): Gender of the patient.
    """
    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: str = Field(..., min_length=1, max_length=255)
    date_of_birth: date
    gender: str = Field(..., min_length=1, max_length=50)

    @validator("date_of_birth", pre=True)
    def parse_date(cls, v):
        if not v:
            return None
        if isinstance(v, date):
            return v
        try:
            return datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("date_of_birth must be in YYYY-MM-DD format")

class PatientCreate(PatientBase):
    """
    Schema for creating a new patient.
    """
    pass

class PatientUpdate(BaseModel):
    """
    Schema for updating an existing patient.

    Attributes:
        first_name (Optional[str]): Updated first name of the patient.
        last_name (Optional[str]): Updated last name of the patient.
        date_of_birth (Optional[date]): Updated date of birth of the patient.
        gender (Optional[str]): Updated gender of the patient.
    """
    first_name: Optional[str] = Field(None, min_length=1, max_length=255)
    last_name: Optional[str] = Field(None, min_length=1, max_length=255)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, min_length=1, max_length=50)

    class Config:
        extra = Extra.ignore  # Ignore unexpected fields instead of failing
        
    @validator("date_of_birth", pre=True)
    def parse_date(cls, v):
        if not v:
            return None
        if isinstance(v, date):
            return v
        try:
            return datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("date_of_birth must be in YYYY-MM-DD format")

class PatientResponse(PatientBase):
    """
    Schema for patient response data.

    Attributes:
        patient_id (UUID): Unique identifier for the patient.
        created_at (datetime): Timestamp when the patient record was created.
        updated_at (datetime): Timestamp when the patient record was last updated.
        full_name (str): Full name of the patient.
        age (int): Age of the patient.
    """
    patient_id: UUID
    created_at: datetime
    updated_at: datetime
    full_name: str
    provider_id: int
    age: int

    class Config:
        from_attributes = True

# CRUD Operations
class PatientCRUD:
    """
    Provides CRUD operations for the PatientModel.

    Args:
        db (Session): SQLAlchemy session for database operations.
    """
    def __init__(self, db: Session):
        """
        Initializes the PatientCRUD instance.

        Args:
            db (Session): SQLAlchemy session for database operations.
        """
        self.db = db

    def get_patient(self, patient_id: UUID, current_provider) -> Optional[PatientModel]:
        try:
            return self.db.query(PatientModel).filter(
                PatientModel.patient_id == patient_id,
                PatientModel.provider_id == current_provider.iUserId,
                PatientModel.is_deleted == False
            ).first()
        except SQLAlchemyError as e:
            self.db.rollback()
            print(f"Database error occurred: {e}")
            return None 

    def get_patients(
            self,
            search: Optional[str] = None,
            current_provider = None
        ) -> List[PatientModel]:
            
            if not current_provider.iUserId:
                raise ValueError("Provider ID must be provided.")

            query = self.db.query(PatientModel).filter(
                PatientModel.provider_id == current_provider.iUserId, 
                PatientModel.is_deleted == False
                )
            if search:
                search = search.strip()
                if search:
                    search = f"%{search}%"
                    query = query.filter(
                        (PatientModel.first_name.ilike(search)) |
                        (PatientModel.last_name.ilike(search))
                    )
            return query.all()

    def create_patient(
            self,
            patient: PatientCreate,
            current_provider
            ) -> PatientModel:
        
        # Create new patient
        db_patient = PatientModel(
            first_name=patient.first_name,
            last_name=patient.last_name,
            date_of_birth=patient.date_of_birth,
            gender=patient.gender,
            provider_id=current_provider.iUserId
        )
        self.db.add(db_patient)
        self.db.commit()
        self.db.refresh(db_patient)
        return db_patient

    def update_patient(
            self, patient_id: UUID, 
            patient: PatientUpdate, current_provider
            ) -> Optional[PatientModel]:
        db_patient = self.get_patient(patient_id, current_provider=current_provider)
        if not db_patient:
            return None
        

        update_data = patient.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(db_patient, key, value)

        self.db.commit()
        self.db.refresh(db_patient)
        return db_patient

    def delete_patient(self, patient_id: UUID, current_provider) -> bool:
        db_patient = self.get_patient(patient_id, current_provider=current_provider)
        if not db_patient:
            return False

        # Soft delete the patient by setting is_deleted to True
        db_patient.is_deleted = True
        self.db.add(db_patient)
        self.db.commit()
        return True

    def bulk_delete_patients(self, patient_ids: List[UUID], current_provider) -> dict:
        """
        Bulk delete patients by their IDs.

        Args:
            patient_ids (List[UUID]): List of patient IDs to delete.
            current_provider: The current provider performing the operation.

        Returns:
            dict: A dictionary containing the count of deleted patients and their IDs.
        """
        deleted_patients = []
        for patient_id in patient_ids:
            db_patient = self.get_patient(patient_id, current_provider)
            if db_patient:
                note_crud = MedicalNoteCRUD(self.db)
                note_crud.delete_notes_by_patient(patient_id, current_provider)
                self.db.delete(db_patient)
                deleted_patients.append(patient_id)

        self.db.commit()
        return {
            "deleted_count": len(deleted_patients),
            "deleted_patient_ids": deleted_patients
        }

    def get_patients_by_age_range(
        self,
        min_age: Optional[int] = None,
        max_age: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[PatientModel]:
        query = self.db.query(PatientModel)
        
        if min_age is not None:
            min_date = date.today().replace(year=date.today().year - min_age)
            query = query.filter(PatientModel.date_of_birth <= min_date)
            
        if max_age is not None:
            max_date = date.today().replace(year=date.today().year - max_age - 1)
            query = query.filter(PatientModel.date_of_birth > max_date)
            
        return query.offset(skip).limit(limit).all()
    
    #!SECTION Admin CRUD Operations
    def admin_create_patient(
            self,
            patient: PatientCreate,
            provider_id: int
    ) -> PatientModel:
        db_patient = PatientModel(
            first_name=patient.first_name,
            last_name=patient.last_name,
            date_of_birth=patient.date_of_birth,
            gender=patient.gender,
            provider_id=provider_id
        )
        self.db.add(db_patient)
        self.db.commit()
        self.db.refresh(db_patient)
        return db_patient

    def admin_get_patients(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        provider_ids: Optional[List[int]] = None
    ) -> List[PatientModel]:
        """
        Get a list of patients with pagination.

        Args:
            skip (int): Number of records to skip.
            limit (int): Maximum number of records to return.

        Returns:
            List[PatientModel]: List of patient models.
        """
        query = self.db.query(PatientModel).filter(
            PatientModel.provider_id.in_(provider_ids),
            PatientModel.is_deleted == False
            )
            
        if search:
            search = search.strip()
            if search:
                search = f"%{search}%"
                query = query.filter(
                    (PatientModel.first_name.ilike(search)) |
                    (PatientModel.last_name.ilike(search))
                )
        
        return query.all()
    
    def admin_get_patient(self, patient_id: UUID) -> Optional[PatientModel]:
        """
        Get a specific patient by their ID.

        Args:
            patient_id (UUID): The UUID of the patient to retrieve.

        Returns:
            Optional[PatientModel]: The patient model if found, otherwise None.
        """
        return self.db.query(PatientModel).filter(
            PatientModel.patient_id == patient_id,
            PatientModel.is_deleted == False
            ).first()
    
    def admin_update_patient(
            self, patient_id: UUID, patient: PatientUpdate
    ) -> Optional[PatientModel]:
        db_patient = self.admin_get_patient(patient_id)
        if not db_patient:
            return None

        update_data = patient.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(db_patient, key, value)

        self.db.commit()
        self.db.refresh(db_patient)
        return db_patient
    
    def admin_delete_patient(self, patient_id: UUID) -> bool:
        db_patient = self.admin_get_patient(patient_id)
        if not db_patient:
            return False

        db_patient.is_deleted = True
        self.db.add(db_patient)
        self.db.commit()    
        return True
    
    def admin_bulk_delete_patients(self, patient_ids: List[UUID]) -> dict:
        """
        Admin method to bulk delete patients by their IDs.

        Args:
            patient_ids (List[UUID]): List of patient IDs to delete.

        Returns:
            dict: A dictionary containing the count of deleted patients and their IDs.
        """
        if not patient_ids:
            return {
                "deleted_count": 0,
                "deleted_patient_ids": []
            }

        # Fetch all patients to be deleted in a single query
        db_patients = self.db.query(PatientModel).filter(
            PatientModel.patient_id.in_(patient_ids),
            PatientModel.is_deleted == False  # Only get non-deleted patients
        ).all()

        deleted_patient_ids = []
        
        # Perform bulk update
        for db_patient in db_patients:
            db_patient.is_deleted = True
            deleted_patient_ids.append(db_patient.patient_id)
        
        # Single commit for all changes
        if deleted_patient_ids:
            self.db.commit()

        return {
            "deleted_count": len(deleted_patient_ids),
            "deleted_patient_ids": deleted_patient_ids
        }
    