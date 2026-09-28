from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from fastapi import UploadFile, File
from pydantic import BaseModel

from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.v2.auth import get_current_provider
from app.v2.models.template import (
    TemplateModel,
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    TemplateCRUD
)
from app.v2.services.v2_blob_handler import BlobStorageHandler

router = APIRouter(
    prefix="/templates",
    tags=["templates"],
    dependencies=[Depends(get_current_provider)]
)

@router.post("/", 
    response_model=TemplateResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Create a new template",
    response_description="The created template")
async def create_template(
    template: TemplateCreate,
    db: Session = Depends(get_db),
    current_provider = Depends(get_current_provider)
):
    """
    Create a new custom template with the following information:
    
    - **name**: Name of the template
    - **description**: Optional description of the template
    - **structure**: Structure type (e.g., SOAP, PROGRESS)
    - **sections**: List of required sections
    - **system_prompt**: Optional custom system prompt
    - **specific_instructions**: Optional specific instructions
    - **is_active**: Whether the template is active (default: True)
    """
    try:
        crud = TemplateCRUD(db)
        return crud.create_template(template=template, current_provider=current_provider)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/", 
    response_model=List[TemplateResponse],
    summary="Get all templates",
    response_description="List of template records")
async def get_templates(
    search: Optional[str] = Query(None, description="Search by name or description"),
    structure: Optional[str] = Query(None, description="Filter by structure type"),
    db: Session = Depends(get_db),
    current_provider = Depends(get_current_provider)
):
    """
    Retrieve a list of templates with optional filtering:
    
    - **search**: Optional search string for name or description
    - **structure**: Optional filter by structure type
    """
    crud = TemplateCRUD(db)
    return crud.get_templates(search=search, structure=structure, current_provider=current_provider)

@router.get("/{template_id}", 
    response_model=TemplateResponse,
    summary="Get a specific template",
    response_description="The requested template record")
async def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_provider = Depends(get_current_provider)
):
    """
    Retrieve a specific template by its ID:
    
    - **template_id**: The UUID of the template to retrieve
    """
    crud = TemplateCRUD(db)
    template = crud.get_template(template_id, current_provider)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return template

@router.put("/{template_id}", 
    response_model=TemplateResponse,
    summary="Update a template",
    response_description="The updated template record")
async def update_template(
    template_id: UUID,
    template_update: TemplateUpdate,
    db: Session = Depends(get_db),
    current_provider = Depends(get_current_provider)
):
    """
    Update an existing template:
    
    - **template_id**: The UUID of the template to update
    - **template_update**: The updated template data
    """
    crud = TemplateCRUD(db)
    template = crud.update_template(template_id, template_update, current_provider)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return template

@router.delete("/{template_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a template",
    response_description="Template successfully deleted")
async def delete_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_provider = Depends(get_current_provider)
):
    """
    Soft delete a template:
    
    - **template_id**: The UUID of the template to delete
    """
    crud = TemplateCRUD(db)
    if not crud.delete_template(template_id, current_provider):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return None

@router.post("/bulk-delete", 
    status_code=status.HTTP_200_OK,
    summary="Bulk delete templates",
    response_description="Number of templates deleted")
async def bulk_delete_templates(
    template_ids: List[UUID],
    db: Session = Depends(get_db),
    current_provider = Depends(get_current_provider)
):
    """
    Bulk soft delete multiple templates:
    
    - **template_ids**: List of template UUIDs to delete
    """
    crud = TemplateCRUD(db)
    result = crud.bulk_delete_templates(template_ids, current_provider)
    return result 