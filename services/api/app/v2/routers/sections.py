from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.v2.auth import get_current_provider
from app.v2.models.note import MedicalNoteCRUD
from app.v2.models.sections import (
    NoteSectionCRUD,
    NoteSectionCreate,
    NoteSectionUpdate,
    NoteSectionResponse,
    SectionType
)

router = APIRouter(
    prefix="/note/sections",
    tags=["note_sections"]
)

async def verify_note_access(
    note_id: UUID,
    current_provider: ProviderModel,
    db: Session
) -> None:
    """Verify that the current provider has access to the specified note."""
    note_crud = MedicalNoteCRUD(db)
    note = note_crud.get_note(note_id, current_provider)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    if note.provider_id != current_provider.iUserId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this note is not authorized"
        )

@router.post("/", 
    response_model=NoteSectionResponse,
    status_code=status.HTTP_201_CREATED)
async def create_section(
    section: NoteSectionCreate,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Create a new section in a medical note.
    
    Parameters:
    - note_id: UUID of the parent note
    - section_type: Type of section (SUBJECTIVE, OBJECTIVE, etc.)
    - content: Section content
    - sequence_number: Order in the note
    """
    await verify_note_access(section.note_id, current_provider, db)
    
    try:
        crud = NoteSectionCRUD(db)
        return crud.create_section(section)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/note/{note_id}", 
    response_model=List[NoteSectionResponse])
async def get_note_sections(
    note_id: UUID,
    section_type: Optional[SectionType] = None,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Get all sections for a specific note, optionally filtered by section type.
    """
    await verify_note_access(note_id, current_provider, db)
    
    crud = NoteSectionCRUD(db)
    return crud.get_sections_by_note(note_id, section_type)

@router.get("/{section_id}", 
    response_model=NoteSectionResponse)
async def get_section(
    section_id: UUID,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Get a specific note section by ID.
    """
    crud = NoteSectionCRUD(db)
    section = crud.get_section(section_id)
    
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    
    await verify_note_access(section.note_id, current_provider, db)
    return section

@router.put("/{section_id}", 
    response_model=NoteSectionResponse)
async def update_section(
    section_id: UUID,
    section: NoteSectionUpdate,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Update an existing note section.
    """
    crud = NoteSectionCRUD(db)
    existing_section = crud.get_section(section_id)
    
    if not existing_section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    
    await verify_note_access(existing_section.note_id, current_provider, db)
    
    try:
        return crud.update_section(section_id, section)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{section_id}",
    status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: UUID,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Delete a note section.
    """
    crud = NoteSectionCRUD(db)
    section = crud.get_section(section_id)
    
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    
    await verify_note_access(section.note_id, current_provider, db)
    
    crud.delete_section(section_id)

@router.post("/note/{note_id}/reorder",
    response_model=List[NoteSectionResponse])
async def reorder_sections(
    note_id: UUID,
    section_orders: List[dict],
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Reorder sections within a note.
    
    Parameters:
    - note_id: UUID of the note
    - section_orders: List of dictionaries containing:
        - section_id: UUID of the section
        - new_sequence_number: New position in the sequence
    """
    await verify_note_access(note_id, current_provider, db)
    
    try:
        crud = NoteSectionCRUD(db)
        return crud.reorder_sections(note_id, section_orders)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/note/{note_id}/type/{section_type}",
    response_model=List[NoteSectionResponse])
async def get_sections_by_type(
    note_id: UUID,
    section_type: SectionType,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Get all sections of a specific type for a note.
    """
    await verify_note_access(note_id, current_provider, db)
    
    crud = NoteSectionCRUD(db)
    return crud.get_sections_by_note(note_id, section_type)

@router.post("/{section_id}/like",
    response_model=NoteSectionResponse)
async def like_section(
    section_id: UUID,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Add a like to the specified section.
    This will also remove any existing dislike.
    """
    crud = NoteSectionCRUD(db)
    section = crud.get_section(section_id)
    
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    
    await verify_note_access(section.note_id, current_provider, db)
    
    updated_section = crud.toggle_reaction(section_id, "like", True)
    return updated_section

@router.post("/{section_id}/dislike",
    response_model=NoteSectionResponse)
async def dislike_section(
    section_id: UUID,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Add a dislike to the specified section.
    This will also remove any existing like.
    """
    crud = NoteSectionCRUD(db)
    section = crud.get_section(section_id)
    
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    
    await verify_note_access(section.note_id, current_provider, db)
    
    updated_section = crud.toggle_reaction(section_id, "dislike", True)
    return updated_section

@router.delete("/{section_id}/reactions",
    response_model=NoteSectionResponse)
async def remove_reactions(
    section_id: UUID,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """
    Remove all reactions (both like and dislike) from the section.
    """
    crud = NoteSectionCRUD(db)
    section = crud.get_section(section_id)
    
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    
    await verify_note_access(section.note_id, current_provider, db)
    
    # First set like to false
    crud.toggle_reaction(section_id, "like", False)
    # Then set dislike to false
    updated_section = crud.toggle_reaction(section_id, "dislike", False)
    
    return updated_section