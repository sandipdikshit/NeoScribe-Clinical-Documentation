from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.v2.auth import get_current_provider
from sqlalchemy.orm import Session
from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.v2.models.note import (
    MedicalNoteCRUD,
    MedicalNoteCreate,
    MedicalNoteUpdate,
    MedicalNoteResponse,
    NoteStatus,
    NoteResponse
)
from app.role_dependency import check_permission, require_any_permission

router = APIRouter(
    prefix="/notes/v1",
    tags=["admin-notes"]
)

@router.get("/get-notes", 
    response_model=List[NoteResponse],
    summary="Get all notes",
    response_description="List of note records")
async def list_notes(
    provider_id: Optional[int] = Query(None, description="Filter by provider IDs"),
    search: Optional[str] = Query(None, description="Search by title or chief complaint"),
    patient_id: Optional[UUID] = Query(None, description="Filter by patient IDs"),
    status: Optional[NoteStatus] = Query(None, description="Filter by note status"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_note_management", "read"))
):
    """
    Retrieve a list of notes with optional filtering:
    
    - **providers**: List of provider IDs to filter by
    - **search**: Optional search string for title or chief complaint
    - **patient_ids**: Optional list of patient IDs to filter by
    - **status**: Optional note status filter
    - **start_date**: Optional start date filter
    - **end_date**: Optional end date filter
    """
    crud = MedicalNoteCRUD(db)
    return crud.admin_get_notes(
        search=search, 
        provider_id=provider_id,
        patient_id=patient_id,
        status=status,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/get-note/{note_id}", 
    response_model=MedicalNoteResponse,
    summary="Get a specific note",
    response_description="The requested note record")
async def get_note(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("admin_note_management", "read"))
):
    """
    Retrieve a specific note by its ID:
    
    - **note_id**: The UUID of the note to retrieve
    """
    crud = MedicalNoteCRUD(db)
    db_note = crud.admin_get_note(note_id)
    if db_note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    return db_note

@router.post("/update-note/{note_id}", 
    response_model=MedicalNoteResponse,
    summary="Update a note",
    response_description="The updated note record")
async def update_note(
    note_id: UUID,
    note: MedicalNoteUpdate,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_note_management", "update"))
):
    """
    Update a specific note by its ID:
    
    - **note_id**: The UUID of the note to update
    - **note**: The updated note data
    """
    crud = MedicalNoteCRUD(db) 
    db_note = crud.admin_get_note(note_id)
    if db_note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    try:
        return crud.admin_update_note(
            note_id=note_id,
            note=note
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/create-note", 
    response_model=MedicalNoteResponse, 
    summary="Create a new note",
    response_description="The created note record")
async def create_note(
    note: MedicalNoteCreate,
    db: Session = Depends(get_db),
    current_provider: ProviderModel = Depends(check_permission("admin_note_management", "create"))
):
    """
    Create a new note:

    - **note**: The note data to create
    """
    crud = MedicalNoteCRUD(db)
    try:
        return crud.admin_create_note(note)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
@router.delete("/delete-note/{note_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a note")
async def delete_note(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_note_management", "delete"))
):
    """
    Delete a specific note by its ID:
    
    - **note_id**: The UUID of the note to delete
    """
    crud = MedicalNoteCRUD(db)
    success = crud.admin_delete_note(note_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    return {"message": "Note deleted successfully"} 