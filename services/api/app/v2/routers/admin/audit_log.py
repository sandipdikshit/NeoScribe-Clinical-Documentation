from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.v2.auth import get_current_provider
from sqlalchemy.orm import Session
from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.v2.models.audit_log import (
    AuditLogCRUD,
    AuditLogCreate,
    AuditLogResponse
)
from app.role_dependency import check_permission, require_any_permission

router = APIRouter(
    prefix="/audit-logs/v1",
    tags=["admin-audit-logs"]
)

@router.post("/get-logs/", 
    response_model=List[AuditLogResponse],
    summary="Get all audit logs",
    response_description="List of audit log records")
async def list_logs(
    providers: List[int],
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    resource: Optional[str] = Query(None, description="Filter by resource ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(100, description="Maximum number of records to return"),
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_audit_log_management", "read"))
):
    """
    Retrieve a list of audit logs with optional filtering:
    
    - **providers**: List of provider IDs to filter by
    - **resource_type**: Optional resource type filter
    - **resource**: Optional resource ID filter
    - **action**: Optional action filter
    - **start_date**: Optional start date filter
    - **end_date**: Optional end date filter
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records to return
    """
    providers.append(current_provider.iUserId)
    if not providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one provider ID must be provided"
        )
    crud = AuditLogCRUD(db)
    providers = [provider for provider in providers]
    return crud.admin_get_logs(
        provider_ids=providers,
        resource_type=resource_type,
        resource=resource,
        action=action,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )

@router.get("/get-log/{log_id}", 
    response_model=AuditLogResponse,
    summary="Get a specific audit log",
    response_description="The requested audit log record")
async def get_log(
    log_id: UUID,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("admin_audit_log_management", "read"))
):
    """
    Retrieve a specific audit log by its ID:
    
    - **log_id**: The UUID of the audit log to retrieve
    """
    crud = AuditLogCRUD(db)
    db_log = crud.admin_get_log(log_id)
    if db_log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found"
        )
    return db_log