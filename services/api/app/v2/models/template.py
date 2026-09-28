from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from sqlalchemy import Column, Integer, DateTime, String, Text, ForeignKey, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID, JSONB
from sqlalchemy.orm import relationship, Session
from pydantic import BaseModel, Field
from app.database import Base
import os
from sqlalchemy.exc import SQLAlchemyError

# SQLAlchemy Model
class TemplateModel(Base):
    """
    SQLAlchemy model for custom note templates.
    
    Attributes:
        template_id (UUID): Primary key for the template
        provider_id (int): Foreign key to the provider who created the template
        name (str): Name of the template
        description (str): Description of the template
        structure (str): Structure type of the template (e.g., SOAP, PROGRESS)
        sections (JSONB): JSON array of required sections
        system_prompt (str): Custom system prompt for the template
        specific_instructions (str): Specific instructions for the template
        is_active (bool): Whether the template is active
        created_at (datetime): Timestamp when the template was created
        updated_at (datetime): Timestamp when the template was last updated
        deleted_at (datetime): Timestamp when the template was soft deleted
    """
    __tablename__ = "note_templates_v2"
    __table_args__ = {'schema': f'{os.getenv("DATABASE_SCHEMA")}'}
    
    template_id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider_id = Column(Integer, ForeignKey(f"{os.getenv('DATABASE_SCHEMA')}.users.iUserId", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    structure = Column(String(50), nullable=False)
    sections = Column(JSONB, nullable=False)
    system_prompt = Column(Text, nullable=True)
    specific_instructions = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    provider = relationship("ProviderModel", back_populates="templates")

    def soft_delete(self):
        """Soft delete the template by setting deleted_at timestamp."""
        self.deleted_at = datetime.utcnow()

    @classmethod
    def get_active(cls, query):
        """Filter query to only return non-deleted records."""
        return query.filter(cls.deleted_at.is_(None))

# Pydantic Schemas
class TemplateBase(BaseModel):
    """Base Pydantic schema for templates."""
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    structure: str = Field(..., min_length=1)
    sections: List[str]
    system_prompt: Optional[str] = None
    specific_instructions: Optional[str] = None
    is_active: bool = True

class TemplateCreate(TemplateBase):
    """Schema for creating a new template."""
    pass

class TemplateUpdate(BaseModel):
    """Schema for updating an existing template."""
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    structure: Optional[str] = Field(None, min_length=1)
    sections: Optional[List[str]] = None
    system_prompt: Optional[str] = None
    specific_instructions: Optional[str] = None
    is_active: Optional[bool] = None

class TemplateResponse(TemplateBase):
    """Schema for template response."""
    template_id: UUID
    provider_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# CRUD Operations
class TemplateCRUD:
    """
    CRUD operations for the TemplateModel.

    Args:
        db (Session): SQLAlchemy session for database operations.
    """
    def __init__(self, db: Session):
        self.db = db

    def get_template(self, template_id: UUID, current_provider) -> Optional[TemplateModel]:
        """
        Retrieve a single template by its ID.

        Args:
            template_id (UUID): The ID of the template to retrieve.
            current_provider: The current provider performing the operation.

        Returns:
            Optional[TemplateModel]: The template if found, None otherwise.
        """
        try:
            return self.db.query(TemplateModel).filter(
                TemplateModel.template_id == template_id,
                TemplateModel.provider_id == current_provider.iUserId,
                TemplateModel.deleted_at.is_(None)
            ).first()
        except SQLAlchemyError as e:
            self.db.rollback()
            print(f"Database error occurred: {e}")
            return None

    def get_templates(
        self,
        search: Optional[str] = None,
        structure: Optional[str] = None,
        current_provider = None
    ) -> List[TemplateModel]:
        """
        Retrieve a list of templates with optional filters.

        Args:
            search (Optional[str]): Search term for template name or description.
            structure (Optional[str]): Filter by template structure.
            current_provider: The current provider performing the operation.

        Returns:
            List[TemplateModel]: List of templates matching the criteria.
        """
        if not current_provider.iUserId:
            raise ValueError("Provider ID must be provided.")

        query = self.db.query(TemplateModel).filter(
            TemplateModel.provider_id == current_provider.iUserId,
            TemplateModel.deleted_at.is_(None)
        )

        if search:
            search = search.strip()
            if search:
                search = f"%{search}%"
                query = query.filter(
                    (TemplateModel.name.ilike(search)) |
                    (TemplateModel.description.ilike(search))
                )

        if structure:
            query = query.filter(TemplateModel.structure == structure)

        return query.order_by(TemplateModel.created_at.desc()).all()

    def create_template(
        self,
        template: TemplateCreate,
        current_provider
    ) -> TemplateModel:
        """
        Create a new template.

        Args:
            template (TemplateCreate): Data for the new template.
            current_provider: The current provider creating the template.

        Returns:
            TemplateModel: The created template.
        """
        db_template = TemplateModel(
            name=template.name,
            description=template.description,
            structure=template.structure,
            sections=template.sections,
            system_prompt=template.system_prompt,
            specific_instructions=template.specific_instructions,
            is_active=template.is_active,
            provider_id=current_provider.iUserId
        )
        self.db.add(db_template)
        self.db.commit()
        self.db.refresh(db_template)
        return db_template

    def update_template(
        self,
        template_id: UUID,
        template: TemplateUpdate,
        current_provider
    ) -> Optional[TemplateModel]:
        """
        Update an existing template.

        Args:
            template_id (UUID): The ID of the template to update.
            template (TemplateUpdate): Updated template data.
            current_provider: The current provider performing the operation.

        Returns:
            Optional[TemplateModel]: The updated template if found, None otherwise.
        """
        db_template = self.get_template(template_id, current_provider)
        if not db_template:
            return None

        update_data = template.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_template, key, value)

        self.db.commit()
        self.db.refresh(db_template)
        return db_template

    def delete_template(self, template_id: UUID, current_provider) -> bool:
        """
        Soft delete a template.

        Args:
            template_id (UUID): The ID of the template to delete.
            current_provider: The current provider performing the operation.

        Returns:
            bool: True if the template was deleted, False otherwise.
        """
        db_template = self.get_template(template_id, current_provider)
        if not db_template:
            return False

        db_template.soft_delete()
        self.db.commit()
        return True

    def bulk_delete_templates(self, template_ids: List[UUID], current_provider) -> dict:
        """
        Bulk soft delete templates by their IDs.

        Args:
            template_ids (List[UUID]): List of template IDs to delete.
            current_provider: The current provider performing the operation.

        Returns:
            dict: A dictionary containing the count of deleted templates and their IDs.
        """
        deleted_templates = []
        for template_id in template_ids:
            db_template = self.get_template(template_id, current_provider)
            if db_template:
                db_template.soft_delete()
                deleted_templates.append(template_id)

        self.db.commit()
        return {
            "deleted_count": len(deleted_templates),
            "deleted_template_ids": deleted_templates
        }

    #!SECTION Admin CRUD Operations
    def admin_create_template(
            self,
            template: TemplateCreate,
            provider_id: int
    ) -> TemplateModel:
        """
        Admin method to create a new template for any provider.

        Args:
            template (TemplateCreate): Data for the new template.
            provider_id (int): ID of the provider to create the template for.

        Returns:
            TemplateModel: The created template.
        """
        db_template = TemplateModel(
            name=template.name,
            description=template.description,
            structure=template.structure,
            sections=template.sections,
            system_prompt=template.system_prompt,
            specific_instructions=template.specific_instructions,
            is_active=template.is_active,
            provider_id=provider_id
        )
        self.db.add(db_template)
        self.db.commit()
        self.db.refresh(db_template)
        return db_template

    def admin_get_templates(
        self,
        search: Optional[str] = None,
        structure: Optional[str] = None,
        provider_id: Optional[int] = None
    ) -> List[TemplateModel]:
        """
        Admin method to get all templates with optional filters.

        Args:
            search (Optional[str]): Search term for template name or description.
            structure (Optional[str]): Filter by template structure.
            provider_ids (Optional[List[int]]): List of provider IDs to filter by.

        Returns:
            List[TemplateModel]: List of templates matching the criteria.
        """
        query = self.db.query(TemplateModel).filter(
            TemplateModel.deleted_at.is_(None)
        )

        if provider_id:
            query = query.filter(TemplateModel.provider_id == provider_id)

        if search:
            search = search.strip()
            if search:
                search = f"%{search}%"
                query = query.filter(
                    (TemplateModel.name.ilike(search)) |
                    (TemplateModel.description.ilike(search))
                )

        if structure:
            query = query.filter(TemplateModel.structure == structure)

        return query.order_by(TemplateModel.created_at.desc()).all()

    def admin_get_template(self, template_id: UUID) -> Optional[TemplateModel]:
        """
        Admin method to get a specific template by its ID.

        Args:
            template_id (UUID): The UUID of the template to retrieve.

        Returns:
            Optional[TemplateModel]: The template if found, None otherwise.
        """
        return self.db.query(TemplateModel).filter(
            TemplateModel.template_id == template_id,
            TemplateModel.deleted_at.is_(None)
        ).first()

    def admin_update_template(
            self, template_id: UUID, template: TemplateUpdate
    ) -> Optional[TemplateModel]:
        """
        Admin method to update a specific template by its ID.

        Args:
            template_id (UUID): The UUID of the template to update.
            template (TemplateUpdate): The updated template data.

        Returns:
            Optional[TemplateModel]: The updated template if found, None otherwise.
        """
        db_template = self.admin_get_template(template_id)
        if not db_template:
            return None

        update_data = template.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_template, key, value)

        self.db.commit()
        self.db.refresh(db_template)
        return db_template

    def admin_delete_template(self, template_id: UUID) -> bool:
        """
        Admin method to soft delete a template by its ID.

        Args:
            template_id (UUID): The UUID of the template to delete.

        Returns:
            bool: True if the template was deleted, False otherwise.
        """
        db_template = self.admin_get_template(template_id)
        if not db_template:
            return False

        db_template.soft_delete()
        self.db.commit()
        return True

    def admin_bulk_delete_templates(self, template_ids: List[UUID]) -> dict:
        """
        Admin method to bulk soft delete templates by their IDs.

        Args:
            template_ids (List[UUID]): List of template IDs to delete.

        Returns:
            dict: A dictionary containing the count of deleted templates and their IDs.
        """
        deleted_templates = []
        for template_id in template_ids:
            db_template = self.admin_get_template(template_id)
            if db_template:
                db_template.soft_delete()
                deleted_templates.append(template_id)

        self.db.commit()
        return {
            "deleted_count": len(deleted_templates),
            "deleted_template_ids": deleted_templates
        } 