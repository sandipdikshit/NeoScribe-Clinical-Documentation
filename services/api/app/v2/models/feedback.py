from datetime import datetime
import enum
import os
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum, Float
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from sqlalchemy.orm import relationship, Session
from pydantic import BaseModel, Field 

from app.database import Base


class FeedbackType(str, enum.Enum):
    """Enum for feedback types"""
    GENERAL = "general"
    BUG = "bug"
    FEATURE_REQUEST = "feature_request"
    IMPROVEMENT = "improvement"
    OTHER = "other"


class FeedbackModel(Base):
    """Feedback model to store user feedback about the application"""
    __tablename__ = "feedbacks"
    __table_args__ = {'schema': f'{os.getenv("DATABASE_SCHEMA")}'}
    
    feedback_id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Subject and content of the feedback
    subject = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    # Type of feedback
    feedback_type = Column(Enum(FeedbackType), default=FeedbackType.GENERAL)
    # Rating on a scale of 1-5
    rating = Column(Float, nullable=True)
    # Relations
    provider_id = Column(Integer, ForeignKey(f"{os.getenv('DATABASE_SCHEMA')}.users.iUserId", ondelete="CASCADE"), nullable=False)    
    # Track creation and update times
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    provider = relationship("ProviderModel", back_populates="feedbacks")



# Pydantic Schemas
class FeedbackBase(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    feedback_type: FeedbackType = Field(default=FeedbackType.GENERAL)
    rating: Optional[float] = Field(None, ge=1, le=5)


class FeedbackCreate(FeedbackBase):
    pass


class FeedbackUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    feedback_type: Optional[FeedbackType] = None
    rating: Optional[float] = Field(None, ge=1, le=5)


class FeedbackResponse(FeedbackBase):
    feedback_id: UUID
    provider_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# CRUD Operations
class FeedbackCRUD:
    def __init__(self, db: Session):
        self.db = db

    def create_feedback(
            self,
            feedback: FeedbackCreate,
            current_provider
            ) -> FeedbackModel:
        
        # Create new feedback
        db_feedback = FeedbackModel(
            subject=feedback.subject,
            content=feedback.content,
            feedback_type=feedback.feedback_type,
            rating=feedback.rating,
            provider_id=current_provider.iUserId
        )
        self.db.add(db_feedback)
        self.db.commit()
        self.db.refresh(db_feedback)
        return db_feedback
    

    ##TODO - Implement get_feedback and get_feedbacks methods for admin
    # def get_feedback(self, feedback_id: UUID, current_provider) -> Optional[FeedbackModel]:
    #     try:
    #         return self.db.query(FeedbackModel).filter(
    #             FeedbackModel.feedback_id == feedback_id,
    #             FeedbackModel.provider_id == current_provider.iUserId
    #         ).first()
    #     except SQLAlchemyError as e:
    #         self.db.rollback()
    #         print(f"Database error occurred: {e}")
    #         return None

    # def get_feedbacks(
    #     self,
    #     feedback_type: Optional[FeedbackType] = None,
    #     patient_id: Optional[UUID] = None,
    #     current_provider = None
    # ) -> List[FeedbackModel]:
        
    #     if not current_provider.iUserId:
    #         raise ValueError("Provider ID must be provided.")

    #     query = self.db.query(FeedbackModel).filter(FeedbackModel.provider_id == current_provider.iUserId)
        
    #     if feedback_type:
    #         query = query.filter(FeedbackModel.feedback_type == feedback_type)
            
    #     if patient_id:
    #         query = query.filter(FeedbackModel.patient_id == patient_id)
            
    #     return query.order_by(FeedbackModel.created_at.desc()).all()

    #!SECTION Admin CRUD Operations
    def admin_create_feedback(
            self,
            feedback: FeedbackCreate,
            provider_id: int
    ) -> FeedbackModel:
        """
        Admin method to create a new feedback for any provider.

        Args:
            feedback (FeedbackCreate): Data for the new feedback.
            provider_id (int): ID of the provider to create the feedback for.

        Returns:
            FeedbackModel: The created feedback.
        """
        db_feedback = FeedbackModel(
            subject=feedback.subject,
            content=feedback.content,
            feedback_type=feedback.feedback_type,
            rating=feedback.rating,
            provider_id=provider_id
        )
        self.db.add(db_feedback)
        self.db.commit()
        self.db.refresh(db_feedback)
        return db_feedback

    def admin_get_feedbacks(
        self,
        search: Optional[str] = None,
        feedback_type: Optional[FeedbackType] = None,
        provider_ids: Optional[List[int]] = None
    ) -> List[FeedbackModel]:
        """
        Admin method to get all feedbacks with optional filters.

        Args:
            search (Optional[str]): Search term for feedback subject or content.
            feedback_type (Optional[FeedbackType]): Filter by feedback type.
            provider_ids (Optional[List[int]]): List of provider IDs to filter by.

        Returns:
            List[FeedbackModel]: List of feedbacks matching the criteria.
        """
        query = self.db.query(FeedbackModel)

        if search:
            search = search.strip()
            if search:
                search = f"%{search}%"
                query = query.filter(
                    (FeedbackModel.subject.ilike(search)) |
                    (FeedbackModel.content.ilike(search))
                )

        if feedback_type:
            query = query.filter(FeedbackModel.feedback_type == feedback_type)

        if provider_ids:
            query = query.filter(FeedbackModel.provider_id.in_(provider_ids))

        return query.order_by(FeedbackModel.created_at.desc()).all()

    def admin_get_feedback(self, feedback_id: UUID) -> Optional[FeedbackModel]:
        """
        Admin method to get a specific feedback by its ID.

        Args:
            feedback_id (UUID): The UUID of the feedback to retrieve.

        Returns:
            Optional[FeedbackModel]: The feedback if found, None otherwise.
        """
        return self.db.query(FeedbackModel).filter(
            FeedbackModel.feedback_id == feedback_id
        ).first()

    def admin_update_feedback(
            self, feedback_id: UUID, feedback: FeedbackUpdate
    ) -> Optional[FeedbackModel]:
        """
        Admin method to update a specific feedback by its ID.

        Args:
            feedback_id (UUID): The UUID of the feedback to update.
            feedback (FeedbackUpdate): The updated feedback data.

        Returns:
            Optional[FeedbackModel]: The updated feedback if found, None otherwise.
        """
        db_feedback = self.admin_get_feedback(feedback_id)
        if not db_feedback:
            return None

        update_data = feedback.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_feedback, key, value)

        self.db.commit()
        self.db.refresh(db_feedback)
        return db_feedback

    def admin_delete_feedback(self, feedback_id: UUID) -> bool:
        """
        Admin method to delete a feedback by its ID.

        Args:
            feedback_id (UUID): The UUID of the feedback to delete.

        Returns:
            bool: True if the feedback was deleted, False otherwise.
        """
        db_feedback = self.admin_get_feedback(feedback_id)
        if not db_feedback:
            return False

        self.db.delete(db_feedback)
        self.db.commit()
        return True

    def admin_bulk_delete_feedbacks(self, feedback_ids: List[UUID]) -> dict:
        """
        Admin method to bulk delete feedbacks by their IDs.

        Args:
            feedback_ids (List[UUID]): List of feedback IDs to delete.

        Returns:
            dict: A dictionary containing the count of deleted feedbacks and their IDs.
        """
        deleted_feedbacks = []
        for feedback_id in feedback_ids:
            db_feedback = self.admin_get_feedback(feedback_id)
            if db_feedback:
                self.db.delete(db_feedback)
                deleted_feedbacks.append(feedback_id)

        self.db.commit()
        return {
            "deleted_count": len(deleted_feedbacks),
            "deleted_feedback_ids": deleted_feedbacks
        }

    
