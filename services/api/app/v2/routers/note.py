from typing import List, Optional
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.role_dependency import check_permission, require_any_permission
from app.v2.models.note import (
    MedicalNoteCRUD,
    MedicalNoteCreate,
    MedicalNoteUpdate,
    MedicalNoteResponse,
    NoteStatus,
    NoteType
)
from app.v2.services.v2_blob_handler import BlobStorageHandler

router = APIRouter(
    prefix="/notes",
    tags=["medical_notes"]
)

@router.post("/", 
    response_model=MedicalNoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new medical note")
async def create_note(
    note: MedicalNoteCreate,
    current_provider= Depends(check_permission("note_management", "create")),
    db: Session = Depends(get_db)
):
    """
    Create a new medical note.
    
    Parameters:
    - patient_id: UUID of the patient
    - visit_date: Date and time of the visit
    - note_type: Type of note (PROGRESS, INITIAL, FOLLOW_UP, etc.)
    - chief_complaint: Primary reason for visit
    - status: Note status (defaults to DRAFT)
    """
    # Ensure provider can only create notes for themselves
    if note.provider_id != current_provider.iUserId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create notes for other providers"
        )

    try:
        crud = MedicalNoteCRUD(db)
        return crud.create_note(note)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/", 
    response_model=List[MedicalNoteResponse],
    summary="Get medical notes with filters")
async def get_notes(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    patient_id: Optional[UUID] = Query(None, description="Filter by patient ID"),
    status: Optional[NoteStatus] = Query(None, description="Filter by note status"),
    note_type: Optional[str] = Query(None, description="Filter by note type"),
    start_date: Optional[datetime] = Query(None, description="Filter by visit date start"),
    end_date: Optional[datetime] = Query(None, description="Filter by visit date end"),
    current_provider= Depends(check_permission("note_management", "read")),
    db: Session = Depends(get_db)
):
    """
    Retrieve medical notes with optional filtering criteria.
    
    Parameters:
    - skip: Number of records to skip (pagination)
    - limit: Maximum number of records to return
    - patient_id: Optional filter by patient
    - status: Optional filter by note status
    - note_type: Optional filter by note type
    - start_date: Optional filter by visit date range start
    - end_date: Optional filter by visit date range end
    """
    crud = MedicalNoteCRUD(db)
    return crud.get_notes(
        skip=skip,
        limit=limit,
        patient_id=patient_id,
        provider_id=current_provider.iUserId,  # Always filter by current provider
        status=status,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/{note_id}", 
    response_model=MedicalNoteResponse,
    summary="Get a specific medical note")
async def get_note(
    note_id: UUID,
    current_provider= Depends(check_permission("note_management", "read")),
    db: Session = Depends(get_db)
):
    """
    Retrieve a specific medical note by ID.
    
    Parameters:
    - note_id: UUID of the note to retrieve
    """
    crud = MedicalNoteCRUD(db)
    note = crud.get_note(note_id, current_provider)
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    # Ensure provider can only view their own notes
    if note.provider_id != current_provider.iUserId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access notes from other providers"
        )
        
    return note

@router.put("/{note_id}", 
    response_model=MedicalNoteResponse,
    summary="Update a medical note")
async def update_note(
    note_id: UUID,
    note_update: MedicalNoteUpdate,
    current_provider= Depends(check_permission("note_management", "update")),
    db: Session = Depends(get_db)
):
    """
    Update an existing medical note.
    
    Parameters:
    - note_id: UUID of the note to update
    - note_update: Updated note information
    """
    crud = MedicalNoteCRUD(db)
    existing_note = crud.get_note(note_id, current_provider)
    
    if not existing_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    # Ensure provider can only update their own notes
    if existing_note.provider_id != current_provider.iUserId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update notes from other providers"
        )

    try:
        updated_note = crud.update_note(note_id, note_update, current_provider)
        return updated_note
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    

@router.delete("/bulk", 
    status_code=status.HTTP_200_OK,
    summary="Bulk delete medical notes")
async def bulk_delete_notes(
    body: dict,
    current_provider= Depends(check_permission("note_management", "delete")),
    db: Session = Depends(get_db)
):
    """
    Bulk delete medical notes by their IDs.

    Parameters:
    - body: A dictionary containing a list of note IDs to delete
    """
    note_ids = body.get("note_ids", [])
    try:
        note_ids = [UUID(note_id) for note_id in note_ids]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input: note_ids must be a list of valid UUIDs"
        )

    crud = MedicalNoteCRUD(db)
    try:
        result = crud.bulk_delete_notes(note_ids, current_provider)
        return {
            "message": "Notes deleted successfully",
            "deleted_count": result["deleted_count"],
            "deleted_note_ids": result["deleted_note_ids"]
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{note_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a medical note")
async def delete_note(
    note_id: UUID,
    current_provider= Depends(check_permission("note_management", "delete")),
    db: Session = Depends(get_db)
):
    """
    Delete a medical note.
    
    Parameters:
    - note_id: UUID of the note to delete
    """
    crud = MedicalNoteCRUD(db)
    existing_note = crud.get_note(note_id, current_provider)
    
    if not existing_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    # Ensure provider can only delete their own notes
    if existing_note.provider_id != current_provider.iUserId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete notes from other providers"
        )

    try:
        crud.delete_note(note_id, current_provider)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/{note_id}/sign", 
    response_model=MedicalNoteResponse,
    summary="Sign a medical note")
async def sign_note(
    note_id: UUID,
    current_provider= Depends(check_permission("note_management", "update")),
    db: Session = Depends(get_db)
):
    """
    Sign a medical note, changing its status to SIGNED.
    
    Parameters:
    - note_id: UUID of the note to sign
    """
    crud = MedicalNoteCRUD(db)
    existing_note = crud.get_note(note_id, current_provider)
    
    if not existing_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    # Ensure provider can only sign their own notes
    if existing_note.provider_id != current_provider.iUserId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot sign notes from other providers"
        )
    
    # Check if note is already signed
    if existing_note.status == NoteStatus.SIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Note is already signed"
        )

    try:
        note_update = MedicalNoteUpdate(status=NoteStatus.SIGNED)
        return crud.update_note(note_id, note_update, current_provider)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/patient/{patient_id}",
    response_model=List[MedicalNoteResponse],
    summary="Get all notes for a specific patient")
async def get_patient_notes(
    patient_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[NoteStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_provider= Depends(check_permission("note_management", "read")),
    db: Session = Depends(get_db)
):
    """
    Retrieve all medical notes for a specific patient.
    
    Parameters:
    - patient_id: UUID of the patient
    - skip: Number of records to skip
    - limit: Maximum number of records to return
    - status: Optional filter by note status
    - start_date: Optional filter by visit date range start
    - end_date: Optional filter by visit date range end
    """
    crud = MedicalNoteCRUD(db)
    return crud.get_notes(
        skip=skip,
        limit=limit,
        patient_id=patient_id,
        provider_id=current_provider.iUserId,
        status=status,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/generate_sas/{note_id}",
    summary="Generate sas url for given blob")
async def get_blob_sas(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("note_management", "read")),
):
    """
    Retrieve all medical notes for a specific patient.
    
    Parameters:
    - patient_id: UUID of the patient
    - skip: Number of records to skip
    - limit: Maximum number of records to return
    - status: Optional filter by note status
    - start_date: Optional filter by visit date range start
    - end_date: Optional filter by visit date range end
    """
    blob_client = BlobStorageHandler()
    crud = MedicalNoteCRUD(db)
    note = crud.get_note(note_id, current_provider)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    sas = blob_client.generate_sas_url(note.blob_filepath)
    return sas

