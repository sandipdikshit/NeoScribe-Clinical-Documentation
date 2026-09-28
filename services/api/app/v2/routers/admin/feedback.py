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
from app.role_dependency import check_permission, require_any_permission

router = APIRouter(
    prefix="/feedbacks/v1",
    tags=["admin-feedbacks"]
)

@router.post("/get-feedbacks/", 
    response_model=List[FeedbackResponse],
    summary="Get all feedbacks",
    response_description="List of feedback records")
async def list_feedbacks(
    providers: List[int],
    search: Optional[str] = Query(None, description="Search by subject or content"),
    feedback_type: Optional[FeedbackType] = Query(None, description="Filter by feedback type"),
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_feedback_management", "read"))
):
    """
    Retrieve a list of feedbacks with optional filtering:
    
    - **providers**: List of provider IDs to filter by
    - **search**: Optional search string for subject or content
    - **feedback_type**: Optional feedback type filter
    """
    providers.append(current_provider.iUserId)
    if not providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one provider ID must be provided"
        )
    crud = FeedbackCRUD(db)
    providers = [provider for provider in providers]
    return crud.admin_get_feedbacks(
        search=search, 
        feedback_type=feedback_type,
        provider_ids=providers
    )

@router.get("/get-feedback/{feedback_id}", 
    response_model=FeedbackResponse,
    summary="Get a specific feedback",
    response_description="The requested feedback record")
async def get_feedback(
    feedback_id: UUID,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("admin_feedback_management", "read"))
):
    """
    Retrieve a specific feedback by its ID:
    
    - **feedback_id**: The UUID of the feedback to retrieve
    """
    crud = FeedbackCRUD(db)
    db_feedback = crud.admin_get_feedback(feedback_id)
    if db_feedback is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found"
        )
    return db_feedback

    
@router.delete("/delete-feedback/{feedback_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a feedback")
async def delete_feedback(
    feedback_id: UUID,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_feedback_management", "delete"))
):
    """
    Delete a specific feedback by its ID:
    
    - **feedback_id**: The UUID of the feedback to delete
    """
    crud = FeedbackCRUD(db)
    success = crud.admin_delete_feedback(feedback_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found"
        )
    return {"message": "Feedback deleted successfully"} 