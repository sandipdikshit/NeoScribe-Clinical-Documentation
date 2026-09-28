from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.v2.models.audit_log import (
    AuditLogModel,
    AuditLogResponse,
    AuditLogCRUD
)
from app.v2.auth import get_current_provider

router = APIRouter(
    prefix="/audit-logs",
    tags=["audit_logs"],
    dependencies=[Depends(get_current_provider)]
)

@router.get("/", 
    response_model=List[AuditLogResponse],
    summary="Get audit logs",
    response_description="List of audit log records")
async def get_audit_logs(
    provider_id: Optional[int] = Query(None, description="Filter by provider ID"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    resource: Optional[str] = Query(None, description="Filter by resource"),
    action: Optional[str] = Query(None, description="Filter by action"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to retrieve"),
    db: Session = Depends(get_db),
    current_provider = Depends(get_current_provider)
):
    """
    Retrieve audit logs with optional filtering:
    
    - **provider_id**: Optional filter by provider ID
    - **resource_type**: Optional filter by resource type
    - **resource_id**: Optional filter by resource ID
    - **action**: Optional filter by action
    - **start_date**: Optional filter by start date
    - **end_date**: Optional filter by end date
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to retrieve (pagination)
    """
    crud = AuditLogCRUD(db)
    return crud.get_logs(
        provider_id=provider_id,
        resource_type=resource_type,
        resource=resource,
        action=action,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )