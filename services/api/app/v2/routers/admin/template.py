from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.v2.auth import get_current_provider
from sqlalchemy.orm import Session
from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.v2.models.template import (
    TemplateCRUD,
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse
)
from app.role_dependency import check_permission, require_any_permission

router = APIRouter(
    prefix="/templates/v1",
    tags=["admin-templates"]
)

@router.post("/get-templates", 
    response_model=List[TemplateResponse],
    summary="Get all templates",
    response_description="List of template records")
async def list_templates(
    search: Optional[str] = Query(None, description="Search by name or description"),
    structure: Optional[str] = Query(None, description="Filter by template structure"),
    provider_id: Optional[int] = Query(None, description="Filter by provider IDs"),
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_template_management", "read"))
):
    """
    Retrieve a list of templates with optional filtering:
    
    - **providers**: List of provider IDs to filter by
    - **search**: Optional search string for name or description
    - **structure**: Optional structure filter
    """

    crud = TemplateCRUD(db)
    return crud.admin_get_templates(
        search=search, 
        structure=structure,
        provider_id = provider_id
    )

@router.get("/get-template/{template_id}", 
    response_model=TemplateResponse,
    summary="Get a specific template",
    response_description="The requested template record")
async def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("admin_template_management", "read"))
):
    """
    Retrieve a specific template by its ID:
    
    - **template_id**: The UUID of the template to retrieve
    """
    crud = TemplateCRUD(db)
    db_template = crud.admin_get_template(template_id)
    if db_template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return db_template

@router.post("/update-template/{template_id}", 
    response_model=TemplateResponse,
    summary="Update a template",
    response_description="The updated template record")
async def update_template(
    template_id: UUID,
    template: TemplateUpdate,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_template_management", "update"))
):
    """
    Update a specific template by its ID:
    
    - **template_id**: The UUID of the template to update
    - **template**: The updated template data
    """
    crud = TemplateCRUD(db) 
    db_template = crud.admin_get_template(template_id)
    if db_template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    try:
        return crud.admin_update_template(
            template_id=template_id,
            template=template
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/create-template", 
    response_model=TemplateResponse, 
    summary="Create a new template",
    response_description="The created template record")
async def create_template(
    template: TemplateCreate,
    provider_id: int = Query(..., description="Provider ID for the template"),
    db: Session = Depends(get_db),
    current_provider: ProviderModel = Depends(check_permission("admin_template_management", "create"))
):
    """
    Create a new template:

    - **template**: The template data to create
    - **provider_id**: Provider ID for the template
    """
    crud = TemplateCRUD(db)
    try:
        return crud.admin_create_template(template, provider_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
@router.delete("/delete-template/{template_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a template")
async def delete_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_template_management", "delete"))
):
    """
    Delete a specific template by its ID:
    
    - **template_id**: The UUID of the template to delete
    """
    crud = TemplateCRUD(db)
    success = crud.admin_delete_template(template_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    return {"message": "Template deleted successfully"} 
