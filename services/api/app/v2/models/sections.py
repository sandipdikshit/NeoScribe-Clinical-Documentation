from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4
from enum import Enum
from app.database import Base

from sqlalchemy import Column, DateTime, String, Text, Integer, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from sqlalchemy.orm import Session, relationship
from pydantic import BaseModel, Field
import os

# Enums for validated fields
class SectionType(str, Enum):
    SUBJECTIVE = "SUBJECTIVE"
    OBJECTIVE = "OBJECTIVE"
    ASSESSMENT = "ASSESSMENT"
    PLAN = "PLAN"
    HISTORY = "HISTORY"
    PHYSICAL_EXAM = "PHYSICAL_EXAM"
    MEDICATIONS = "MEDICATIONS"
    ALLERGIES = "ALLERGIES"
    REVIEW_OF_SYSTEMS = "REVIEW_OF_SYSTEMS"
    LABS = "LABS"
    IMAGING = "IMAGING"

# SQLAlchemy Model
class NoteSectionModel(Base):
    """
    SQLAlchemy model for note sections.

    Attributes:
        section_id (UUID): Primary key for the section.
        note_id (UUID): Foreign key referencing the medical note.
        section_name (str): Name of the section.
        section_type (str): Type of the section (e.g., SUBJECTIVE, OBJECTIVE).
        content (str): Content of the section.
        sequence_number (int): Sequence number of the section within the note.
        created_at (datetime): Timestamp when the section was created.
        updated_at (datetime): Timestamp when the section was last updated.
    """
    __tablename__ = "note_sections_v2"
    __table_args__ = (
        UniqueConstraint('note_id', 'sequence_number', name='unique_note_sequence'),
        {'schema': f'{os.getenv("DATABASE_SCHEMA")}'}
    )
    section_id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid4)
    note_id = Column(SQLAlchemyUUID(as_uuid=True), ForeignKey(f"{os.getenv('DATABASE_SCHEMA')}.medical_notes_v2.note_id", ondelete="CASCADE"), nullable=False)
    section_name = Column(String(255), nullable=False)
    section_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    sequence_number = Column(Integer, nullable=False)
    is_like = Column(Boolean, default=False, nullable=False)  # New column for likes
    is_dislike = Column(Boolean, default=False, nullable=False)  # New column for dislikes
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship
    note = relationship("MedicalNoteModel", back_populates="sections")

# Pydantic Schemas
class NoteSectionBase(BaseModel):
    """
    Base Pydantic schema for note sections.

    Attributes:
        section_type (Optional[str]): Type of the section.
        section_name (Optional[str]): Name of the section.
        content (str): Content of the section.
        sequence_number (int): Sequence number of the section.
    """
    section_type: Optional[str] = None
    section_name: Optional[str] = None
    content: str = Field(..., min_length=1)
    sequence_number: int = Field(..., ge=0)
    is_like: Optional[bool] = False  # New field for likes
    is_dislike: Optional[bool] = False  # New field for dislikes

class NoteSectionCreate(NoteSectionBase):
    """
    Pydantic schema for creating a note section.

    Attributes:
        note_id (UUID): ID of the note to which the section belongs.
    """
    note_id: UUID
    sequence_number: Optional[int] = Field(None, ge=0)

class NoteSectionUpdate(BaseModel):
    """
    Pydantic schema for updating a note section.

    Attributes:
        section_type (Optional[str]): Updated type of the section.
        content (Optional[str]): Updated content of the section.
        sequence_number (Optional[int]): Updated sequence number of the section.
    """
    section_type: Optional[str] = None
    content: Optional[str] = Field(None, min_length=1)
    sequence_number: Optional[int] = Field(None, ge=0)
    is_like: Optional[bool] = None  # New field for likes
    is_dislike: Optional[bool] = None  # New field for dislikes

class NoteSectionResponse(NoteSectionBase):
    """
    Pydantic schema for note section response.

    Attributes:
        section_id (UUID): ID of the section.
        note_id (UUID): ID of the note to which the section belongs.
        created_at (datetime): Timestamp when the section was created.
        updated_at (datetime): Timestamp when the section was last updated.
    """
    section_id: UUID
    note_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# CRUD Operations
class NoteSectionCRUD:
    """
    CRUD operations for note sections.

    Methods:
        __init__(db: Session): Initializes the CRUD instance with a database session.
        get_section(section_id: UUID) -> Optional[NoteSectionModel]: Retrieves a section by its ID.
        get_sections_by_note(note_id: UUID, section_type: Optional[str] = None) -> List[NoteSectionModel]:
            Retrieves all sections for a specific note, optionally filtered by type.
        create_section(section: NoteSectionCreate) -> NoteSectionModel:
            Creates a new note section and handles sequence number conflicts.
        update_section(section_id: UUID, section: NoteSectionUpdate, reorder: bool = True) -> Optional[NoteSectionModel]:
            Updates an existing note section, optionally reordering sequence numbers.
        delete_section(section_id: UUID) -> bool:
            Deletes a note section and reorders remaining sections.
        reorder_sections(note_id: UUID, section_orders: List[dict]) -> List[NoteSectionModel]:
            Reorders multiple sections at once based on provided sequence numbers.
    """
    def __init__(self, db: Session):
        """
        Initializes the CRUD instance with a database session.

        Args:
            db (Session): SQLAlchemy database session.
        """
        self.db = db

    def get_section(self, section_id: UUID) -> Optional[NoteSectionModel]:
        """
        Retrieves a section by its ID.

        Args:
            section_id (UUID): ID of the section to retrieve.

        Returns:
            Optional[NoteSectionModel]: The retrieved section or None if not found.
        """
        return self.db.query(NoteSectionModel).filter(NoteSectionModel.section_id == section_id).first()

    def get_sections_by_note(
        self, 
        note_id: UUID,
        section_type: Optional[str] = None
    ) -> List[NoteSectionModel]:
        """
        Retrieves all sections for a specific note, optionally filtered by type.

        Args:
            note_id (UUID): ID of the note.
            section_type (Optional[str]): Type of sections to filter by.

        Returns:
            List[NoteSectionModel]: List of matching sections.
        """
        query = self.db.query(NoteSectionModel).filter(NoteSectionModel.note_id == note_id)
        
        if section_type:
            query = query.filter(NoteSectionModel.section_type == section_type)
            
        return query.order_by(NoteSectionModel.sequence_number).all()

    def create_section(self, section: NoteSectionCreate) -> NoteSectionModel:
        """
        Creates a new note section and handles sequence number conflicts.

        Args:
            section (NoteSectionCreate): Data for the new section.

        Returns:
            NoteSectionModel: The created section.
        """
        # Check if sequence number is already used in this note
        existing = self.db.query(NoteSectionModel).filter(
            NoteSectionModel.note_id == section.note_id,
            NoteSectionModel.sequence_number == section.sequence_number
        ).first()
        
        if existing:
            # Auto-increment sequence numbers to make room
            self.db.query(NoteSectionModel).filter(
                NoteSectionModel.note_id == section.note_id,
                NoteSectionModel.sequence_number >= section.sequence_number
            ).update(
                {NoteSectionModel.sequence_number: NoteSectionModel.sequence_number + 1}
            )
            self.db.commit()

        db_section = NoteSectionModel(**section.model_dump())
        self.db.add(db_section)
        self.db.commit()
        self.db.refresh(db_section)
        return db_section

    def update_section(
        self, 
        section_id: UUID, 
        section: NoteSectionUpdate,
        reorder: bool = True
    ) -> Optional[NoteSectionModel]:
        """
        Updates an existing note section, optionally reordering sequence numbers.

        Args:
            section_id (UUID): ID of the section to update.
            section (NoteSectionUpdate): Updated data for the section.
            reorder (bool): Whether to reorder sequence numbers.

        Returns:
            Optional[NoteSectionModel]: The updated section or None if not found.
        """
        db_section = self.get_section(section_id)
        if not db_section:
            return None

        update_data = section.model_dump(exclude_unset=True)
        
        # Handle sequence number changes
        if "sequence_number" in update_data and reorder:
            new_seq = update_data["sequence_number"]
            old_seq = db_section.sequence_number
            
            if new_seq != old_seq:
                # Check if new sequence number is already used
                existing = self.db.query(NoteSectionModel).filter(
                    NoteSectionModel.note_id == db_section.note_id,
                    NoteSectionModel.sequence_number == new_seq
                ).first()
                
                if existing:
                    # Shift other sections accordingly
                    if new_seq > old_seq:
                        # Moving down - shift intervening sections up
                        self.db.query(NoteSectionModel).filter(
                            NoteSectionModel.note_id == db_section.note_id,
                            NoteSectionModel.sequence_number > old_seq,
                            NoteSectionModel.sequence_number <= new_seq
                        ).update(
                            {NoteSectionModel.sequence_number: NoteSectionModel.sequence_number - 1}
                        )
                    else:
                        # Moving up - shift intervening sections down
                        self.db.query(NoteSectionModel).filter(
                            NoteSectionModel.note_id == db_section.note_id,
                            NoteSectionModel.sequence_number >= new_seq,
                            NoteSectionModel.sequence_number < old_seq
                        ).update(
                            {NoteSectionModel.sequence_number: NoteSectionModel.sequence_number + 1}
                        )

        for key, value in update_data.items():
            setattr(db_section, key, value)

        self.db.commit()
        self.db.refresh(db_section)
        return db_section

    def delete_section(self, section_id: UUID) -> bool:
        """
        Deletes a note section and reorders remaining sections.

        Args:
            section_id (UUID): ID of the section to delete.

        Returns:
            bool: True if the section was deleted, False otherwise.
        """
        db_section = self.get_section(section_id)
        if not db_section:
            return False
        
        # Get the sequence number and note_id before deletion
        seq_num = db_section.sequence_number
        note_id = db_section.note_id
        
        # Delete the section
        self.db.delete(db_section)
        
        # Reorder remaining sections
        self.db.query(NoteSectionModel).filter(
            NoteSectionModel.note_id == note_id,
            NoteSectionModel.sequence_number > seq_num
        ).update(
            {NoteSectionModel.sequence_number: NoteSectionModel.sequence_number - 1}
        )
        
        self.db.commit()
        return True

    def reorder_sections(self, note_id: UUID, section_orders: List[dict]) -> List[NoteSectionModel]:
        """
        Reorders multiple sections at once based on provided sequence numbers.

        Args:
            note_id (UUID): ID of the note to which the sections belong.
            section_orders (List[dict]): List of dictionaries with section_id and new_sequence_number.

        Returns:
            List[NoteSectionModel]: List of reordered sections.
        """
        # Validate all sections exist and belong to the note
        for order in section_orders:
            section = self.get_section(order['section_id'])
            if not section or section.note_id != note_id:
                raise ValueError(f"Invalid section_id: {order['section_id']}")

        # Update all sequence numbers
        for order in section_orders:
            self.update_section(
                order['section_id'],
                NoteSectionUpdate(sequence_number=order['new_sequence_number']),
                reorder=False  # Skip individual reordering as we're doing it in batch
            )

        self.db.commit()
        return self.get_sections_by_note(note_id)

    def delete_sections_by_note(self, note_id: UUID) -> int:
        """
        Delete all sections for a given note_id.
        Returns the number of sections deleted.
        """
        deleted_count = self.db.query(NoteSectionModel).filter(
            NoteSectionModel.note_id == note_id
        ).delete(synchronize_session=False)
        
        self.db.commit()
        return deleted_count
    
    def toggle_reaction(
        self, 
        section_id: UUID, 
        reaction_type: str, 
        value: bool
    ) -> Optional[NoteSectionModel]:
        """
        Toggle like or dislike for a section.
        
        Parameters:
        - section_id: UUID of the section
        - reaction_type: Either 'like' or 'dislike'
        - value: Boolean value to set
        
        Returns:
        - Updated section model or None if section not found
        """
        db_section = self.get_section(section_id)
        if not db_section:
            return None
            
        if reaction_type == 'like':
            # Set the like status
            db_section.is_like = value
            # If setting like to true, make sure dislike is false (mutually exclusive)
            if value == True:
                db_section.is_dislike = False
        elif reaction_type == 'dislike':
            # Set the dislike status
            db_section.is_dislike = value
            # If setting dislike to true, make sure like is false (mutually exclusive)
            if value == True:
                db_section.is_like = False
        else:
            raise ValueError(f"Invalid reaction type: {reaction_type}")
            
        self.db.commit()
        self.db.refresh(db_section)
        return db_section

    #!SECTION Admin CRUD Operations
    def admin_create_section(
            self,
            section: NoteSectionCreate
    ) -> NoteSectionModel:
        """
        Admin method to create a new note section.

        Args:
            section (NoteSectionCreate): Data for the new section.

        Returns:
            NoteSectionModel: The created section.
        """
        # Check if sequence number is already used in this note
        last_section = self.db.query(NoteSectionModel).filter(
            NoteSectionModel.note_id == section.note_id
        ).order_by(NoteSectionModel.sequence_number.desc()).first()
        
        if last_section:
            # Auto-increment sequence numbers to make room
            # print(f"Existing sections count: {last_section.count()}")
            section.sequence_number = last_section.sequence_number + 1
        else:
            section.sequence_number = 0

        db_section = NoteSectionModel(**section.model_dump())
        self.db.add(db_section)
        self.db.commit()
        self.db.refresh(db_section)
        return db_section

    def admin_get_sections(
        self,
        search: Optional[str] = None,
        section_type: Optional[str] = None,
        note_id: UUID = None
    ) -> List[NoteSectionModel]:
        """
        Admin method to get all sections with optional filters.

        Args:
            search (Optional[str]): Search term for section content.
            section_type (Optional[str]): Filter by section type.
            note_ids (Optional[List[UUID]]): List of note IDs to filter by.

        Returns:
            List[NoteSectionModel]: List of sections matching the criteria.
        """
        query = self.db.query(NoteSectionModel).filter(NoteSectionModel.note_id == note_id)

        if search:
            search = search.strip()
            if search:
                search = f"%{search}%"
                query = query.filter(
                    (NoteSectionModel.content.ilike(search)) |
                    (NoteSectionModel.section_name.ilike(search))
                )

        if section_type:
            query = query.filter(NoteSectionModel.section_type == section_type)

        return query.order_by(NoteSectionModel.created_at.asc()).all()

    def admin_get_section(self, section_id: UUID) -> Optional[NoteSectionModel]:
        """
        Admin method to get a specific section by its ID.

        Args:
            section_id (UUID): The UUID of the section to retrieve.

        Returns:
            Optional[NoteSectionModel]: The section if found, None otherwise.
        """
        return self.db.query(NoteSectionModel).filter(
            NoteSectionModel.section_id == section_id
        ).first()

    def admin_update_section(
            self, section_id: UUID, section: NoteSectionUpdate
    ) -> Optional[NoteSectionModel]:
        """
        Admin method to update a specific section by its ID.

        Args:
            section_id (UUID): The UUID of the section to update.
            section (NoteSectionUpdate): The updated section data.

        Returns:
            Optional[NoteSectionModel]: The updated section if found, None otherwise.
        """
        db_section = self.admin_get_section(section_id)
        if not db_section:
            return None

        update_data = section.model_dump(exclude_unset=True)
        
        # Handle sequence number changes
        if "sequence_number" in update_data:
            new_seq = update_data["sequence_number"]
            old_seq = db_section.sequence_number
            
            if new_seq != old_seq:
                # Check if new sequence number is already used
                existing = self.db.query(NoteSectionModel).filter(
                    NoteSectionModel.note_id == db_section.note_id,
                    NoteSectionModel.sequence_number == new_seq
                ).first()
                
                if existing:
                    # Shift other sections accordingly
                    if new_seq > old_seq:
                        # Moving down - shift intervening sections up
                        self.db.query(NoteSectionModel).filter(
                            NoteSectionModel.note_id == db_section.note_id,
                            NoteSectionModel.sequence_number > old_seq,
                            NoteSectionModel.sequence_number <= new_seq
                        ).update(
                            {NoteSectionModel.sequence_number: NoteSectionModel.sequence_number - 1}
                        )
                    else:
                        # Moving up - shift intervening sections down
                        self.db.query(NoteSectionModel).filter(
                            NoteSectionModel.note_id == db_section.note_id,
                            NoteSectionModel.sequence_number >= new_seq,
                            NoteSectionModel.sequence_number < old_seq
                        ).update(
                            {NoteSectionModel.sequence_number: NoteSectionModel.sequence_number + 1}
                        )

        for key, value in update_data.items():
            setattr(db_section, key, value)

        self.db.commit()
        self.db.refresh(db_section)
        return db_section

    def admin_delete_section(self, section_id: UUID) -> bool:
        """
        Admin method to delete a section by its ID.

        Args:
            section_id (UUID): The UUID of the section to delete.

        Returns:
            bool: True if the section was deleted, False otherwise.
        """
        db_section = self.admin_get_section(section_id)
        if not db_section:
            return False
        
        # Get the sequence number and note_id before deletion
        seq_num = db_section.sequence_number
        note_id = db_section.note_id
        
        # Delete the section
        self.db.delete(db_section)
        
        self.db.commit()
        return True

    def admin_bulk_delete_sections(self, section_ids: List[UUID]) -> dict:
        """
        Admin method to bulk delete sections by their IDs.

        Args:
            section_ids (List[UUID]): List of section IDs to delete.

        Returns:
            dict: A dictionary containing the count of deleted sections and their IDs.
        """
        deleted_sections = []
        for section_id in section_ids:
            db_section = self.admin_get_section(section_id)
            if db_section:
                # Get the sequence number and note_id before deletion
                seq_num = db_section.sequence_number
                note_id = db_section.note_id
                
                # Delete the section
                self.db.delete(db_section)
                
                # Reorder remaining sections
                self.db.query(NoteSectionModel).filter(
                    NoteSectionModel.note_id == note_id,
                    NoteSectionModel.sequence_number > seq_num
                ).update(
                    {NoteSectionModel.sequence_number: NoteSectionModel.sequence_number - 1}
                )
                
                deleted_sections.append(section_id)

        self.db.commit()
        return {
            "deleted_count": len(deleted_sections),
            "deleted_section_ids": deleted_sections
        }