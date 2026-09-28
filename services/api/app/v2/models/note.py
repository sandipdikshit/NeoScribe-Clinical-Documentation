from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4
from enum import Enum
from sqlalchemy import Column, DateTime, String, Text, ForeignKey, Index, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID, JSONB
from sqlalchemy.orm import Session, relationship
from pydantic import BaseModel, Field
from app.database import Base
from app.v2.models.sections import NoteSectionCRUD
import os
# Enums for validated fields
class NoteType(str, Enum):
    """
    Enum for different types of medical notes.
    """
    SOAP = "SOAP"
    PROGRESS = "PROGRESS"
    CONSULTATION = "CONSULTATION"   
    PROCEDURE = "PROCEDURE"
    DISCHARGE = "DISCHARGE"
    EMERGENCY = "EMERGENCY"
    PSYCHIATRIC = "PSYCHIATRIC"
    ANNUAL = "ANNUAL"
    ADMISSION = "ADMISSION"
    HOSPITAL = "HOSPITAL"
    OPERATIVE = "OPERATIVE"
    WOUND = "WOUND"
    STANDARD = "STANDARD_THERAPY"
    CUSTOM = "CUSTOM"  # For custom note types

    @classmethod
    def _missing_(cls, value):
        """
        Handle custom note types by returning CUSTOM type.
        This allows the enum to accept any string value while maintaining type safety.
        """
        return cls.CUSTOM

class NoteStatus(str, Enum):
    """
    Enum for different statuses of a medical note.
    """
    DRAFT = "DRAFT"
    PROCESSING = "PROCESSING"
    PENDING = "PENDING"
    SIGNED = "SIGNED"   
    AMENDED = "AMENDED"
    GENERATED = "GENERATED"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"
    REVIEWING = "REVIEWING"
    QUALITY_CHECK = "QUALITY_CHECK"
    EVALUATING = "EVALUATING"
    ANALYZING = "ANALYZING"
    FAILED = "FAILED"

# SQLAlchemy Model
class MedicalNoteModel(Base):
    """
    SQLAlchemy model for the `medical_notes_v2` table.

    Attributes:
        note_id (UUID): Primary key for the note.
        patient_id (UUID): Foreign key to the patient.
        provider_id (int): Foreign key to the provider.
        job_id (UUID): Optional job ID associated with the note.
        visit_date (datetime): Date of the visit.
        note_title (str): Title of the note.
        note_type (str): Type of the note.
        status (str): Status of the note.
        chief_complaint (str): Chief complaint of the patient.
        transcription_result (dict): Transcription result in JSON format.
        analytics_result (dict): Analytics result in JSON format.
        blob_filepath (str): Filepath of the associated blob.
        blob_filename (str): Filename of the associated blob.
        is_deleted (bool): Indicates if the note is deleted.
        signed_at (datetime): Timestamp when the note was signed.
        created_at (datetime): Timestamp when the note was created.
        updated_at (datetime): Timestamp when the note was last updated.
    """
    __tablename__ = "medical_notes_v2"
    __table_args__ = (
        Index('idx_medical_notes_patient_id', 'patient_id'),
        Index('idx_medical_notes_provider_id', 'provider_id'),
        Index('idx_medical_notes_visit_date', 'visit_date'),
        Index('idx_medical_notes_status', 'status'),
        {'schema': f'{os.getenv("DATABASE_SCHEMA")}'}
    )

    note_id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id = Column(SQLAlchemyUUID(as_uuid=True), ForeignKey(f"{os.getenv('DATABASE_SCHEMA')}.patients_v2.patient_id", ondelete="CASCADE"), nullable=False)
    provider_id = Column(Integer, ForeignKey(f"{os.getenv('DATABASE_SCHEMA')}.users.iUserId", ondelete="CASCADE"), nullable=False)
    job_id = Column(SQLAlchemyUUID(as_uuid=True), nullable=True)
    visit_date = Column(DateTime(timezone=True), nullable=False)
    note_title = Column(String(255), nullable=False)
    note_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default=NoteStatus.DRAFT)
    chief_complaint = Column(Text, nullable=False)
    transcription_result = Column(JSONB, nullable=True)
    analytics_result = Column(JSONB, nullable=True)
    evaluation_result = Column(JSONB, nullable=True)
    blob_filepath = Column(String(255), nullable=True)
    blob_filename = Column(String(255), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    signed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    patients = relationship("PatientModel", back_populates="medical_notes")
    provider = relationship("ProviderModel", back_populates="medical_notes")
    sections = relationship("NoteSectionModel", back_populates="note")

# Pydantic Schemas
class MedicalNoteBase(BaseModel):
    """
    Base Pydantic schema for medical notes.

    Attributes:
        visit_date (datetime): Date of the visit.
        note_type (NoteType): Type of the note.
        note_title (str): Title of the note.
        chief_complaint (str): Chief complaint of the patient.
        status (NoteStatus): Status of the note.
        is_deleted (bool): Indicates if the note is deleted.
    """
    visit_date: datetime
    note_type: str
    note_title: str = Field(..., min_length=1)
    chief_complaint: str = Field(..., min_length=1)
    status: Optional[NoteStatus] = NoteStatus.DRAFT
    is_deleted: bool = False

class MedicalNoteCreate(MedicalNoteBase):
    """
    Pydantic schema for creating a medical note.

    Attributes:
        job_id (UUID): Job ID associated with the note.
        patient_id (UUID): ID of the patient.
        provider_id (int): ID of the provider.
    """
    job_id: UUID
    patient_id: UUID
    provider_id: int

class MedicalNoteUpdate(BaseModel):
    """
    Pydantic schema for updating a medical note.

    Attributes:
        visit_date (datetime): Date of the visit.
        note_title (str): Title of the note.
        note_type (NoteType): Type of the note.
        chief_complaint (str): Chief complaint of the patient.
        transcription_result (dict): Transcription result in JSON format.
        analytics_result (dict): Analytics result in JSON format.
        blob_filename (str): Filename of the associated blob.
        blob_filepath (str): Filepath of the associated blob.
        status (NoteStatus): Status of the note.
        is_deleted (bool): Indicates if the note is deleted.
    """
    visit_date: Optional[datetime] = None
    note_title: Optional[str] = Field(None, min_length=1)
    note_type: Optional[str] = None
    chief_complaint: Optional[str] = Field(None, min_length=1)
    transcription_result: Optional[dict] = None
    analytics_result: Optional[dict] = None
    evaluation_result: Optional[dict] = None
    blob_filename : Optional[str] = None
    blob_filepath : Optional[str] = None
    status: Optional[NoteStatus] = None
    is_deleted: Optional[bool] = None

class MedicalNoteResponse(MedicalNoteBase):
    """
    Pydantic schema for the response of a medical note.

    Attributes:
        note_id (UUID): ID of the note.
        patient_id (UUID): ID of the patient.
        provider_id (int): ID of the provider.
        transcription_result (dict): Transcription result in JSON format.
        blob_filename (str): Filename of the associated blob.
        blob_filepath (str): Filepath of the associated blob.
        signed_at (datetime): Timestamp when the note was signed.
        created_at (datetime): Timestamp when the note was created.
        updated_at (datetime): Timestamp when the note was last updated.
    """
    note_id: UUID
    patient_id: UUID
    provider_id: int
    note_type: str
    chief_complaint : str
    status: NoteStatus
    transcription_result: Optional[dict]
    evaluation_result: Optional[dict]
    blob_filename : Optional[str]
    blob_filepath : Optional[str]
    signed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


    class Config:
        from_attributes = True


class NoteResponse(BaseModel):
    """
    Pydantic schema for the response of a medical note.

    Attributes:
        note_id (UUID): ID of the note.
        patient_id (UUID): ID of the patient.
        provider_id (int): ID of the provider.
        note_title (str): Title of the note.
        visit_date (datetime): Date of the visit.
        status (NoteStatus): Status of the note.
    """
    note_id: UUID
    chief_complaint: str
    note_type: str
    patient_id: UUID
    provider_id: int
    note_title: str
    visit_date: datetime
    status: NoteStatus
    created_at: datetime

# CRUD Operations
class MedicalNoteCRUD:
    """
    CRUD operations for medical notes.

    Methods:
        get_note(note_id): Retrieve a single note by its ID.
        get_notes(skip, limit, patient_id, provider_id, status, start_date, end_date): Retrieve a list of notes with optional filters.
        create_note(note): Create a new medical note.
        update_note(note_id, note): Update an existing medical note.
        delete_note(note_id): Delete a medical note.
    """
    def __init__(self, db: Session):
        """
        Initialize the CRUD class with a database session.

        Args:
            db (Session): SQLAlchemy database session.
        """
        self.db = db

    def get_note(self, note_id: UUID, current_provider) -> Optional[MedicalNoteModel]:
        return self.db.query(MedicalNoteModel).filter(
            MedicalNoteModel.note_id == note_id,
            MedicalNoteModel.provider_id == current_provider.iUserId
            ).first()

    def get_notes(
        self,
        skip: int = 0,
        limit: int = 100,
        patient_id: Optional[UUID] = None,
        provider_id: Optional[int] = None,
        status: Optional[NoteStatus] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[MedicalNoteModel]:
        """
        Retrieve a list of medical notes with optional filters.

        Args:
            skip (int): Number of records to skip.
            limit (int): Maximum number of records to retrieve.
            patient_id (UUID): Filter by patient ID.
            provider_id (int): Filter by provider ID.
            status (NoteStatus): Filter by note status.
            start_date (datetime): Filter by start date.
            end_date (datetime): Filter by end date.

        Returns:
            List[MedicalNoteModel]: List of medical notes.
        """
        query = self.db.query(MedicalNoteModel)

        if patient_id:
            query = query.filter(MedicalNoteModel.patient_id == patient_id)
        if provider_id: 
            query = query.filter(MedicalNoteModel.provider_id == provider_id)
        if status:
            query = query.filter(MedicalNoteModel.status == status)
        if start_date:
            query = query.filter(MedicalNoteModel.visit_date >= start_date)
        if end_date:
            query = query.filter(MedicalNoteModel.visit_date <= end_date)

        return query.order_by(MedicalNoteModel.created_at.desc()).offset(skip).limit(limit).all()

    def create_note(self, note: MedicalNoteCreate) -> MedicalNoteModel:
        """
        Create a new medical note.

        Args:
            note (MedicalNoteCreate): Data for the new medical note.

        Returns:
            MedicalNoteModel: The created medical note.
        """
        db_note = MedicalNoteModel(**note.model_dump())
        self.db.add(db_note)
        self.db.commit()
        self.db.refresh(db_note)
        return db_note

    def update_note(self, note_id: UUID, note: MedicalNoteUpdate, current_provider) -> Optional[MedicalNoteModel]:
        db_note = self.get_note(note_id, current_provider)
        if not db_note:
            return None

        # Don't allow updates to signed notes unless amending
        if db_note.status == NoteStatus.SIGNED and note.status != NoteStatus.AMENDED:
            raise ValueError("Cannot update a signed note unless amending")

        update_data = note.model_dump(exclude_unset=True)
        
        # If status is being changed to SIGNED, set signed_at
        if update_data.get("status") == NoteStatus.SIGNED:
            update_data["signed_at"] = datetime.utcnow()

        for key, value in update_data.items():
            setattr(db_note, key, value)

        self.db.commit()
        self.db.refresh(db_note)
        return db_note

    def delete_note(self, note_id: UUID, current_provider) -> bool:
        db_note = self.get_note(note_id, current_provider)
        if not db_note:
            return False
        
        sections_crud = NoteSectionCRUD(self.db)
        print(f"Deleting sections for note ID: {note_id}")
        deletedCount = sections_crud.delete_sections_by_note(note_id)
            
        self.db.delete(db_note)
        self.db.commit()
        return {
            "noteId": note_id,
            "message": f"deleted {deletedCount} sections"
        }

    def delete_notes_by_provider(self, provider_id: int) -> int:
        """
        Deletes all notes associated with a specific provider.
        Returns the count of deleted notes.
        """
        notes_to_delete = self.db.query(MedicalNoteModel).filter(
            MedicalNoteModel.provider_id == provider_id,
            MedicalNoteModel.status != NoteStatus.SIGNED
        ).all()

        if not notes_to_delete:
            return 0

        for note in notes_to_delete:
            sections_crud = NoteSectionCRUD(self.db)
            sections_crud.delete_sections_by_note(note.note_id)
            self.db.delete(note)

        self.db.commit()
        return len(notes_to_delete)

    def delete_notes_by_patient(self, patient_id: UUID, current_provider) -> int:
        """
        Deletes all notes associated with a specific patient.
        Returns the count of deleted notes.
        """
        notes_to_delete = self.db.query(MedicalNoteModel).filter(
            MedicalNoteModel.patient_id == patient_id,
            MedicalNoteModel.provider_id == current_provider.iUserId,
        ).all()

        if not notes_to_delete:
            return 0

        for note in notes_to_delete:
            sections_crud = NoteSectionCRUD(self.db)
            sections_crud.delete_sections_by_note(note.note_id)
            self.db.delete(note)

        self.db.commit()
        return len(notes_to_delete)

    def bulk_delete_notes(self, note_ids: List[UUID], current_provider) -> dict:
        """
        Bulk delete medical notes by their IDs.

        Args:
            note_ids (List[UUID]): List of note IDs to delete.
            current_provider: The current provider performing the operation.

        Returns:
            dict: A dictionary containing the count of deleted notes and their IDs.
        """
        deleted_notes = []
        for note_id in note_ids:
            db_note = self.get_note(note_id, current_provider)
            if db_note:
                sections_crud = NoteSectionCRUD(self.db)
                sections_crud.delete_sections_by_note(note_id)
                self.db.delete(db_note)
                deleted_notes.append(note_id)

        self.db.commit()
        return {
            "deleted_count": len(deleted_notes),
            "deleted_note_ids": deleted_notes
        }
    

    #!SECTION Admin CRUD Operations
    def admin_create_note(
            self,
            note: MedicalNoteCreate
    ) -> MedicalNoteModel:
        """
        Admin method to create a new medical note.

        Args:
            note (MedicalNoteCreate): Data for the new medical note.

        Returns:
            MedicalNoteModel: The created medical note.
        """
        db_note = MedicalNoteModel(**note.model_dump())
        self.db.add(db_note)
        self.db.commit()
        self.db.refresh(db_note)
        return db_note

    def admin_get_notes(
        self,
        search: Optional[str] = None,
        provider_id: Optional[int] = None,
        patient_id: Optional[UUID] = None,
        status: Optional[NoteStatus] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[MedicalNoteModel]:
        """
        Admin method to get all notes with optional filters.

        Args:
            search (Optional[str]): Search term for note title or chief complaint.
            provider_ids (Optional[List[int]]): List of provider IDs to filter by.
            patient_ids (Optional[List[UUID]]): List of patient IDs to filter by.
            status (Optional[NoteStatus]): Filter by note status.
            start_date (Optional[datetime]): Filter by start date.
            end_date (Optional[datetime]): Filter by end date.

        Returns:
            List[MedicalNoteModel]: List of notes matching the criteria.
        """
        query = self.db.query(MedicalNoteModel).filter(
            MedicalNoteModel.is_deleted == False
        )

        if search:
            query = query.filter(
                MedicalNoteModel.note_title.ilike(f"%{search}%") |
                MedicalNoteModel.chief_complaint.ilike(f"%{search}%")
            )

        if provider_id:
            query = query.filter(MedicalNoteModel.provider_id == provider_id)

        if patient_id:
            query = query.filter(MedicalNoteModel.patient_id == patient_id)

        if status:
            query = query.filter(MedicalNoteModel.status == status)

        if start_date:
            query = query.filter(MedicalNoteModel.visit_date >= start_date)

        if end_date:
            query = query.filter(MedicalNoteModel.visit_date <= end_date)

        return query.order_by(MedicalNoteModel.created_at.desc()).all()

    def admin_get_note(self, note_id: UUID) -> Optional[MedicalNoteModel]:
        """
        Admin method to get a specific note by its ID.

        Args:
            note_id (UUID): The UUID of the note to retrieve.

        Returns:
            Optional[MedicalNoteModel]: The note if found, None otherwise.
        """
        return self.db.query(MedicalNoteModel).filter(
            MedicalNoteModel.note_id == note_id,
            MedicalNoteModel.is_deleted == False
        ).first()

    def admin_update_note(
            self, note_id: UUID, note: MedicalNoteUpdate
    ) -> Optional[MedicalNoteModel]:
        """
        Admin method to update a specific note by its ID.

        Args:
            note_id (UUID): The UUID of the note to update.
            note (MedicalNoteUpdate): The updated note data.

        Returns:
            Optional[MedicalNoteModel]: The updated note if found, None otherwise.
        """
        db_note = self.admin_get_note(note_id)
        if not db_note:
            return None

        update_data = note.model_dump(exclude_unset=True)
        
        # If status is being changed to SIGNED, set signed_at
        if update_data.get("status") == NoteStatus.SIGNED:
            update_data["signed_at"] = datetime.utcnow()

        for key, value in update_data.items():
            setattr(db_note, key, value)

        self.db.commit()
        self.db.refresh(db_note)
        return db_note

    def admin_delete_note(self, note_id: UUID) -> bool:
        """
        Admin method to delete a note by its ID.

        Args:
            note_id (UUID): The UUID of the note to delete.

        Returns:
            bool: True if the note was deleted, False otherwise.
        """
        db_note = self.admin_get_note(note_id)
        if not db_note:
            return False
        
        sections_crud = NoteSectionCRUD(self.db)
        sections_crud.delete_sections_by_note(note_id)
            
        self.db.delete(db_note)
        self.db.commit()
        return True

    def admin_bulk_delete_notes(self, note_ids: List[UUID]) -> dict:
        """
        Admin method to bulk delete notes by their IDs.

        Args:
            note_ids (List[UUID]): List of note IDs to delete.

        Returns:
            dict: A dictionary containing the count of deleted notes and their IDs.
        """
        deleted_notes = []
        for note_id in note_ids:
            db_note = self.admin_get_note(note_id)
            if db_note:
                sections_crud = NoteSectionCRUD(self.db)
                sections_crud.delete_sections_by_note(note_id)
                self.db.delete(db_note)
                deleted_notes.append(note_id)

        self.db.commit()
        return {
            "deleted_count": len(deleted_notes),
            "deleted_note_ids": deleted_notes
        }
    
