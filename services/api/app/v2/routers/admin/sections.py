from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.v2.auth import get_current_provider
from sqlalchemy.orm import Session
from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.v2.models.sections import (
    NoteSectionCRUD,
    NoteSectionCreate,
    NoteSectionUpdate,
    NoteSectionResponse
)
from app.role_dependency import check_permission, require_any_permission

router = APIRouter(
    prefix="/sections/v1",
    tags=["admin-sections"]
)

@router.get("/get-sections/{note_id}", 
    response_model=List[NoteSectionResponse],
    summary="Get all sections",
    response_description="List of section records")
async def list_sections(
    note_id: UUID,
    search: Optional[str] = Query(None, description="Search by content or section name"),
    section_type: Optional[str] = Query(None, description="Filter by section type"),
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_section_management", "read"))
):
    """
    Retrieve a list of sections with optional filtering:
    
    - **search**: Optional search string for content or section name
    - **section_type**: Optional section type filter
    - **note_ids**: Optional list of note IDs to filter by
    """
    crud = NoteSectionCRUD(db)
    return crud.admin_get_sections(
        search=search, 
        section_type=section_type,
        note_id=note_id
    )

@router.get("/get-section/{section_id}", 
    response_model=NoteSectionResponse,
    summary="Get a specific section",
    response_description="The requested section record")
async def get_section(
    section_id: UUID,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("admin_section_management", "read"))
):
    """
    Retrieve a specific section by its ID:
    
    - **section_id**: The UUID of the section to retrieve
    """
    crud = NoteSectionCRUD(db)
    db_section = crud.admin_get_section(section_id)
    if db_section is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    return db_section

@router.post("/update-section/{section_id}", 
    response_model=NoteSectionResponse,
    summary="Update a section",
    response_description="The updated section record")
async def update_section(
    section_id: UUID,
    section: NoteSectionUpdate,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_section_management", "update"))
):
    """
    Update a specific section by its ID:
    
    - **section_id**: The UUID of the section to update
    - **section**: The updated section data
    """
    crud = NoteSectionCRUD(db) 
    db_section = crud.admin_get_section(section_id)
    if db_section is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    
    try:
        return crud.admin_update_section(
            section_id=section_id,
            section=section
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/create-section/",
    response_model=NoteSectionResponse, 
    summary="Create a new section",
    response_description="The created section record")
async def create_section(
    section: NoteSectionCreate,
    db: Session = Depends(get_db),
    current_provider: ProviderModel = Depends(check_permission("admin_section_management", "create"))
):
    """
    Create a new section:

    - **section**: The section data to create
    """
    crud = NoteSectionCRUD(db)
    try:
        return crud.admin_create_section(section)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
@router.delete("/delete-section/{section_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a section")
async def delete_section(
    section_id: UUID,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_section_management", "delete"))
):
    """
    Delete a specific section by its ID:
    
    - **section_id**: The UUID of the section to delete
    """
    crud = NoteSectionCRUD(db)
    success = crud.admin_delete_section(section_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found"
        )
    return {"message": "Section deleted successfully"} 