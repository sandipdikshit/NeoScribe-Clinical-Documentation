from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.v2.auth import get_current_provider
from sqlalchemy.orm import Session

from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.v2.models.feedback import (
    FeedbackCRUD,
    FeedbackCreate,
    FeedbackUpdate,
    FeedbackResponse,
    FeedbackType
)

router = APIRouter(
    prefix="/feedback", 
    tags=["feedback"]
)

@router.post("/", 
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit new feedback",
    response_description="The created feedback record")
async def create_feedback(
    feedback: FeedbackCreate,
    db: Session = Depends(get_db),
    current_provider = Depends(get_current_provider)
):
    """
    Submit new feedback with the following information:
    
    - **subject**: Brief subject of the feedback
    - **content**: Detailed feedback content
    - **feedback_type**: Type of feedback (general, bug, feature_request, improvement, other)
    - **rating**: Optional rating from 1-5
    - **patient_id**: Optional UUID of related patient
    """
    try:
        crud = FeedbackCRUD(db)
        return crud.create_feedback(feedback=feedback, current_provider=current_provider)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# @router.get("/", 
#     response_model=List[FeedbackResponse],
#     summary="Get all feedback",
#     response_description="List of feedback records")
# async def list_feedback(
#     feedback_type: Optional[FeedbackType] = Query(None, description="Filter by feedback type"),
#     patient_id: Optional[UUID] = Query(None, description="Filter by patient ID"),
#     db: Session = Depends(get_db),
#     current_provider = Depends(get_current_provider)
# ):
#     """
#     Retrieve a list of feedback with optional filtering:
    
#     - **feedback_type**: Optional filter by feedback type
#     - **patient_id**: Optional filter by related patient
#     """
#     crud = FeedbackCRUD(db)
#     return crud.get_feedbacks(
#         feedback_type=feedback_type, 
#         patient_id=patient_id, 
#         current_provider=current_provider
#     )

# @router.get("/{feedback_id}", 
#     response_model=FeedbackResponse,
#     summary="Get specific feedback",
#     response_description="The requested feedback record")
# async def get_feedback(
#     feedback_id: UUID,
#     db: Session = Depends(get_db),
#     current_provider = Depends(get_current_provider)
# ):
#     """
#     Retrieve specific feedback by ID:
    
#     - **feedback_id**: The UUID of the feedback to retrieve
#     """
#     crud = FeedbackCRUD(db)
#     db_feedback = crud.get_feedback(feedback_id, current_provider)
#     if db_feedback is None:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Feedback not found"
#         )
#     return db_feedback