from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.v2.auth import get_current_provider
from sqlalchemy.orm import Session
from app.database import get_db
from app.v2.models.provider import (
    ProviderCRUD,
    ProviderResponse,
    ProviderModel,
    ProviderUpdate
)
from app.role_dependency import check_permission, require_any_permission
from datetime import datetime

router = APIRouter(
    prefix="/providers/v1",
    tags=["admin-providers"]
)

@router.post("/get-providers/", 
    response_model=List[ProviderResponse],
    summary="Get all providers",
    response_description="List of provider records")
async def list_providers(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(100, description="Maximum number of records to return"),
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_provider_management", "read"))
):
    """
    Retrieve a list of providers with pagination:
    
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records to return
    """
    crud = ProviderCRUD(db)
    return crud.admin_get_providers(skip=skip, limit=limit)

@router.get("/get-provider/{provider_id}", 
    response_model=ProviderResponse,
    summary="Get a specific provider",
    response_description="The requested provider record")
async def get_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("admin_provider_management", "read"))
):
    """
    Retrieve a specific provider by its ID:
    
    - **provider_id**: The ID of the provider to retrieve
    """
    crud = ProviderCRUD(db)
    db_provider = crud.get_provider(provider_id)
    if db_provider is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    return db_provider

@router.post("/update-provider/{provider_id}", 
    response_model=ProviderResponse,
    summary="Update a provider",
    response_description="The updated provider record")
async def update_provider(
    provider_id: int,
    provider: ProviderUpdate,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_provider_management", "update"))
):
    """
    Update a specific provider by its ID:
    
    - **provider_id**: The ID of the provider to update
    - **provider**: The updated provider data
    """
    crud = ProviderCRUD(db) 
    db_provider = crud.get_provider(provider_id)
    if db_provider is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    try:
        return crud.admin_update_provider(provider_id, provider)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/delete-provider/{provider_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a provider")
async def delete_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_provider_management", "delete"))
):
    """
    Delete a specific provider by its ID:
    
    - **provider_id**: The ID of the provider to delete
    """
    crud = ProviderCRUD(db)
    success = crud.admin_delete_provider(provider_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    return {"message": "Provider deleted successfully"} 