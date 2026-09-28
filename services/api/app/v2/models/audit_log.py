from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
from sqlalchemy import Column, Integer, DateTime, String, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID, JSONB
from sqlalchemy.orm import relationship, Session
from pydantic import BaseModel, Field
from app.database import Base
import os

# SQLAlchemy Model
class AuditLogModel(Base):
    """
    SQLAlchemy model for audit logs.
    
    Attributes:
        log_id (UUID): Primary key for the log
        provider_id (int): Foreign key to the provider who performed the action
        path (str): The API endpoint path where the action occurred
        action (str): The action performed (e.g., CREATE, UPDATE, DELETE)
        resource_type (str): Type of resource being acted upon (e.g., TEMPLATE, PATIENT)
        resource (str): ID of the resource being acted upon
        details (JSONB): Additional details about the action
        ip_address (str): IP address of the request
        user_agent (str): User agent of the request
        created_at (datetime): Timestamp when the log was created
    """
    __tablename__ = "audit_logs"
    __table_args__ = {'schema': f'{os.getenv("DATABASE_SCHEMA")}'}
    
    log_id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider_id = Column(Integer, ForeignKey(f"{os.getenv('DATABASE_SCHEMA')}.users.iUserId", ondelete="SET NULL"), nullable=True)
    path = Column(Text, nullable=True)
    action = Column(String(50), nullable=True)
    resource_type = Column(String(50), nullable=True)
    resource = Column(Text, nullable=True)
    details = Column(JSONB, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # Relationships
    provider = relationship("ProviderModel", back_populates="audit_logs")

# Pydantic Schemas
class AuditLogBase(BaseModel):
    """Base Pydantic schema for audit logs."""
    path : str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    resource_type: str = Field(..., min_length=1)
    resource: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    """Schema for creating a new audit log."""
    provider_id: Optional[int] = None

class AuditLogResponse(AuditLogBase):
    """Schema for audit log response."""
    log_id: UUID
    provider_id: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True

# CRUD Operations
class AuditLogCRUD:
    """
    CRUD operations for the AuditLogModel.

    Args:
        db (Session): SQLAlchemy session for database operations.
    """
    def __init__(self, db: Session):
        self.db = db

    def create_log(
        self,
        path: str,
        action: str,
        resource_type: str,
        provider_id: Optional[int] = None,
        resource: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLogModel:
        """
        Create a new audit log entry.

        Args:
            action (str): The action performed
            resource_type (str): Type of resource being acted upon
            provider_id (Optional[int]): ID of the provider who performed the action
            resource (Optional[str]): ID of the resource being acted upon
            details (Optional[Dict[str, Any]]): Additional details about the action
            ip_address (Optional[str]): IP address of the request
            user_agent (Optional[str]): User agent of the request

        Returns:
            AuditLogModel: The created audit log entry
        """
        db_log = AuditLogModel(
            path=path,
            action=action,
            resource_type=resource_type,
            provider_id=provider_id,
            resource=resource,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(db_log)
        self.db.commit()
        self.db.refresh(db_log)
        return db_log

    def get_logs(
        self,
        provider_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list[AuditLogModel]:
        """
        Retrieve audit logs with optional filters.

        Args:
            provider_id (Optional[int]): Filter by provider ID
            resource_type (Optional[str]): Filter by resource type
            resource (Optional[str]): Filter by resource ID
            action (Optional[str]): Filter by action
            start_date (Optional[datetime]): Filter by start date
            end_date (Optional[datetime]): Filter by end date
            skip (int): Number of records to skip
            limit (int): Maximum number of records to retrieve

        Returns:
            list[AuditLogModel]: List of audit log entries
        """
        query = self.db.query(AuditLogModel)

        if provider_id:
            query = query.filter(AuditLogModel.provider_id == provider_id)
        if resource_type:
            query = query.filter(AuditLogModel.resource_type == resource_type)
        if resource:
            query = query.filter(AuditLogModel.resource == resource)
        if action:
            query = query.filter(AuditLogModel.action == action)
        if start_date:
            query = query.filter(AuditLogModel.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLogModel.created_at <= end_date)

        return query.order_by(AuditLogModel.created_at.desc()).offset(skip).limit(limit).all()

    #!AUDIT LOGS Admin CRUD Operations
    def admin_create_log(
        self,
        path: str,
        action: str,
        resource_type: str,
        provider_id: Optional[int] = None,
        resource: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLogModel:
        """
        Admin method to create a new audit log entry.

        Args:
            path (str): The API endpoint path where the action occurred
            action (str): The action performed
            resource_type (str): Type of resource being acted upon
            provider_id (Optional[int]): ID of the provider who performed the action
            resource (Optional[str]): ID of the resource being acted upon
            details (Optional[Dict[str, Any]]): Additional details about the action
            ip_address (Optional[str]): IP address of the request
            user_agent (Optional[str]): User agent of the request

        Returns:
            AuditLogModel: The created audit log entry
        """
        db_log = AuditLogModel(
            path=path,
            action=action,
            resource_type=resource_type,
            provider_id=provider_id,
            resource=resource,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(db_log)
        self.db.commit()
        self.db.refresh(db_log)
        return db_log

    def admin_get_logs(
        self,
        provider_ids: Optional[List[int]] = None,
        resource_type: Optional[str] = None,
        resource: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list[AuditLogModel]:
        """
        Admin method to retrieve audit logs with optional filters.

        Args:
            provider_ids (Optional[List[int]]): List of provider IDs to filter by
            resource_type (Optional[str]): Filter by resource type
            resource (Optional[str]): Filter by resource ID
            action (Optional[str]): Filter by action
            start_date (Optional[datetime]): Filter by start date
            end_date (Optional[datetime]): Filter by end date
            skip (int): Number of records to skip
            limit (int): Maximum number of records to retrieve

        Returns:
            list[AuditLogModel]: List of audit log entries
        """
        query = self.db.query(AuditLogModel)

        if provider_ids:
            query = query.filter(AuditLogModel.provider_id.in_(provider_ids))
        if resource_type:
            query = query.filter(AuditLogModel.resource_type == resource_type)
        if resource:
            query = query.filter(AuditLogModel.resource == resource)
        if action:
            query = query.filter(AuditLogModel.action == action)
        if start_date:
            query = query.filter(AuditLogModel.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLogModel.created_at <= end_date)

        return query.order_by(AuditLogModel.created_at.desc()).offset(skip).limit(limit).all()

    def admin_get_log(self, log_id: UUID) -> Optional[AuditLogModel]:
        """
        Admin method to get a specific audit log by its ID.

        Args:
            log_id (UUID): The UUID of the audit log to retrieve.

        Returns:
            Optional[AuditLogModel]: The audit log if found, None otherwise.
        """
        return self.db.query(AuditLogModel).filter(
            AuditLogModel.log_id == log_id
        ).first()

    def admin_delete_log(self, log_id: UUID) -> bool:
        """
        Admin method to delete an audit log by its ID.

        Args:
            log_id (UUID): The UUID of the audit log to delete.

        Returns:
            bool: True if the audit log was deleted, False otherwise.
        """
        db_log = self.admin_get_log(log_id)
        if not db_log:
            return False

        self.db.delete(db_log)
        self.db.commit()
        return True

    def admin_bulk_delete_logs(self, log_ids: List[UUID]) -> dict:
        """
        Admin method to bulk delete audit logs by their IDs.

        Args:
            log_ids (List[UUID]): List of audit log IDs to delete.

        Returns:
            dict: A dictionary containing the count of deleted audit logs and their IDs.
        """
        deleted_logs = []
        for log_id in log_ids:
            db_log = self.admin_get_log(log_id)
            if db_log:
                self.db.delete(db_log)
                deleted_logs.append(log_id)

        self.db.commit()
        return {
            "deleted_count": len(deleted_logs),
            "deleted_log_ids": deleted_logs
        }