from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, DateTime, String, Index
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
import os

# SQLAlchemy Model
class RoleModel(Base):
    """
    SQLAlchemy model for the `roles` table.

    Attributes:
        role_id (UUID): Primary key for the role.
        role_name (str): Name of the role.
        permissions (dict): Permissions associated with the role.
        status (str): Status of the role (e.g., ACTIVE, INACTIVE).
        created_at (datetime): Timestamp when the role was created.
        updated_at (datetime): Timestamp when the role was last updated.
    """
    __tablename__ = "roles"
    __table_args__ = (
        Index('idx_role_status', 'role_status'),
        Index('idx_role_name', 'role_name'),
        {'schema': f'{os.getenv("DATABASE_SCHEMA")}'}
    )

    role_id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid4)
    role_name = Column(String(50), nullable=False, unique=True)
    permissions = Column(JSONB, nullable=True)
    role_status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships - use string references to avoid circular imports
    providers = relationship("ProviderModel", back_populates="role", lazy="joined")
