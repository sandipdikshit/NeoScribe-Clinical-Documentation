from typing import List, Optional
from sqlalchemy import Column, String, Integer, Boolean, Text, UUID, ForeignKey
from sqlalchemy.orm import Session, relationship
from pydantic import BaseModel, Field
from passlib.context import CryptContext
import os

from app.database import Base

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# SQLAlchemy Model
class ProviderModel(Base):
    __tablename__ = "users"
    __table_args__ = {'schema': f'{os.getenv("DATABASE_SCHEMA")}'}

    iUserId = Column(Integer, primary_key=True)
    vName = Column(String(100), nullable=False)
    vEmail = Column(String(250), nullable=False, unique=True, index=True)
    txPassword = Column(Text, nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey(f"{os.getenv('DATABASE_SCHEMA')}.roles.role_id", ondelete="CASCADE"), nullable=True)
    iOTP = Column(Integer, nullable=True)
    vSpeciality = Column(String(100), nullable=False)
    isVerified = Column(Boolean, nullable=True)
    tiStatus = Column(Integer, nullable=False, default=1)
    iCreatedAt = Column(Integer, nullable=False)
    iUpdatedAt = Column(Integer, nullable=False)
    iNPI = Column(Integer, nullable=True, unique=True)

    # Use string references to avoid circular imports
    medical_notes = relationship("MedicalNoteModel", back_populates="provider")
    patients = relationship("PatientModel", back_populates="provider")
    feedbacks = relationship("FeedbackModel", back_populates="provider")
    templates = relationship("TemplateModel", back_populates="provider")
    audit_logs = relationship("AuditLogModel", back_populates="provider")
    role = relationship("RoleModel", back_populates="providers", lazy="joined")

    def verify_password(self, plain_password: str) -> bool:
        """
        Verify the provided password against the stored hash.

        Args:
            plain_password (str): The plain text password to verify.

        Returns:
            bool: True if the password matches, False otherwise.
        """
        return pwd_context.verify(plain_password, self.password_hash)
    
class ProviderResponse(BaseModel):
    """
    Pydantic model for provider response.

    Attributes:
        id (int): Unique identifier for the provider.
        name (str): Name of the provider.
        email (str): Email address of the provider.
        speciality (str): Speciality of the provider.
        is_verified (bool): Verification status of the provider.
    """
    iUserId: int = Field(..., alias="iUserId")
    vName: str = Field(..., alias="vName")
    vEmail: str = Field(..., alias="vEmail")
    vSpeciality: str = Field(..., alias="vSpeciality")
    isVerified: bool = Field(..., alias="isVerified")
    iNPI: Optional[int] = Field(None, alias="iNPI")

    class Config:
        from_attributes = True

class ProviderUpdate(BaseModel):
    """
    Pydantic model for updating an existing provider.

    Attributes:
        name (Optional[str]): Name of the provider.
        email (Optional[str]): Email address of the provider.
        password (Optional[str]): Password for the provider account.
        speciality (Optional[str]): Speciality of the provider.
        npi (Optional[int]): National Provider Identifier, if applicable.
    """
    vName: Optional[str] = Field(None, alias="vName")
    vEmail: Optional[str] = Field(None, alias="vEmail")
    txPassword: Optional[str] = Field(None, alias="txPassword")
    vSpeciality: Optional[str] = Field(None, alias="vSpeciality")
    iNPI: Optional[int] = Field(None, alias="iNPI")

    class Config:
        from_attributes = True

# CRUD Operations
class ProviderCRUD:
    """
    CRUD operations for the ProviderModel.

    Args:
        db (Session): SQLAlchemy session for database operations.
    """
    def __init__(self, db: Session):
        self.db = db

    def get_provider(self, provider_id: str) -> Optional[ProviderModel]:
        return self.db.query(ProviderModel).filter(ProviderModel.iUserId == provider_id).first()
    
    def admin_create_provider(
            self,
            provider: ProviderModel
            ) -> ProviderModel:
        """
        Create a new provider in the database.

        Args:
            provider (ProviderModel): The provider model to create.

        Returns:
            ProviderModel: The created provider model.
        """
        self.db.add(provider)
        self.db.commit()
        self.db.refresh(provider)
        return provider
    
    def admin_get_providers(
            self,
            skip: int = 0,
            limit: int = 100
            ) -> List[ProviderModel]:
        """
        Get a list of providers with pagination.

        Args:
            skip (int): Number of records to skip.
            limit (int): Maximum number of records to return.

        Returns:
            List[ProviderModel]: List of provider models.
        """
        return self.db.query(ProviderModel).filter(ProviderModel.tiStatus == 1).offset(skip).limit(limit).all()
    
    def admin_update_provider(
            self,
            provider_id: int,
            provider_data: ProviderModel
            ) -> ProviderModel:
        """
        Update an existing provider in the database.

        Args:
            provider_id (int): ID of the provider to update.
            provider_data (ProviderModel): The updated provider model.

        Returns:
            ProviderModel: The updated provider model.
        """
        provider = self.get_provider(provider_id)
        if not provider:
            raise ValueError("Provider not found")
        
        for key, value in provider_data.dict(exclude_unset=True).items():
            setattr(provider, key, value)
        
        self.db.commit()
        self.db.refresh(provider)
        return provider
    
    def admin_delete_provider(
            self,
            provider_id: int
            ) -> bool:
        """
        Delete a provider from the database.

        Args:
            provider_id (int): ID of the provider to delete.

        Returns:
            bool: True if deletion was successful, False otherwise.
        """
        provider = self.get_provider(provider_id)
        if not provider:
            return False
        
        provider.tiStatus = 0  # Soft delete
        self.db.add(provider)
        self.db.commit()
        return True