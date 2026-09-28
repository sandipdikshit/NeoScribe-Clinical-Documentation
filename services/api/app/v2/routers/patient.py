from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.v2.models.patient import (
    PatientCRUD,
    PatientCreate,
    PatientUpdate,
    PatientResponse
)
from app.v2.models.encryption import EncryptedResponse, EncryptedRequest
from app.v2.models.provider import ProviderModel
from app.v2.auth import get_current_provider
from app.role_dependency import check_permission
from app.decorators.decrypt_request import decrypt_request
from app.decorators.encrypt_response import encrypt_response
import logging


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/patients", 
    tags=["patients"]
)

@router.post(
    "/",
    response_model=PatientResponse | EncryptedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new patient",
    response_description="The created patient record"
)
@decrypt_request(PatientCreate)
@encrypt_response
async def create_patient(
    request: Request,
    data: PatientCreate | EncryptedRequest,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """
    Create a new patient with the following information:
    
    - **first_name**: Patient's first name
    - **last_name**: Patient's last name
    - **date_of_birth**: Date of birth (YYYY-MM-DD)
    - **gender**: Patient's gender
    """
    try:
        crud = PatientCRUD(db)
        response = crud.create_patient(data, current_provider=current_provider)

        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/", 
    response_model=List[PatientResponse] | EncryptedResponse,
    summary="Get all patients",
    response_description="List of patient records")
@encrypt_response
async def list_patients(
    request: Request,
    search: Optional[str] = Query(None, description="Search by name"),
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("patient_management", "read"))
):
    """
    Retrieve a list of patients with optional filtering:
    
    - **search**: Optional search string for name
    - **min_age**: Optional minimum age filter
    - **max_age**: Optional maximum age filter
    """
    crud = PatientCRUD(db)
    return crud.get_patients(search=search, current_provider=current_provider,)

@router.get("/{patient_id}", 
    response_model=PatientResponse | EncryptedResponse,
    summary="Get a specific patient",
    response_description="The requested patient record")
@encrypt_response
async def get_patient(
    request: Request,
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("patient_management", "read"))
):
    """
    Retrieve a specific patient by their ID:
    
    - **patient_id**: The UUID of the patient to retrieve
    """
    crud = PatientCRUD(db)
    db_patient = crud.get_patient(patient_id, current_provider)

    if db_patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    return db_patient

@router.put("/{patient_id}", 
    response_model=PatientResponse | EncryptedResponse,
    summary="Update a patient",
    response_description="The updated patient record")
@decrypt_request(PatientUpdate)
@encrypt_response
async def update_patient(
    request: Request,
    patient_id: UUID,
    data: PatientUpdate,
    current_provider: ProviderModel = Depends(get_current_provider),
    db: Session = Depends(get_db),
):
    """
    
    Update a patient's information:
    
    - **patient_id**: The UUID of the patient to update
    - **patient**: The updated patient information
    """
    crud = PatientCRUD(db)
    try:
        db_patient = crud.update_patient(patient_id=patient_id, patient=data, current_provider=current_provider)
        if db_patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        return db_patient
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/bulk", 
    status_code=status.HTTP_200_OK,
    summary="Bulk delete patients")
async def bulk_delete_patients(
    body: dict,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("patient_management", "delete"))
):
    """
    Bulk delete patients by their IDs.

    Parameters:
    - body: A dictionary containing a list of patient IDs to delete
    """
    patient_ids = body.get("patient_ids", [])
    try:
        patient_ids = [UUID(patient_id) for patient_id in patient_ids]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input: patient_ids must be a list of valid UUIDs"
        )

    crud = PatientCRUD(db)
    try:
        result = crud.bulk_delete_patients(patient_ids, current_provider)
        return {
            "message": "Patients deleted successfully",
            "deleted_count": result["deleted_count"],
            "deleted_patient_ids": result["deleted_patient_ids"]
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{patient_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a patient")
async def delete_patient(
    patient_id: UUID,
    db: Session = Depends(get_db), 
    current_provider: int = Depends(check_permission("patient_management", "delete"))
):
    """
    Delete a patient from the system:
    
    - **patient_id**: The UUID of the patient to delete
    """
    crud = PatientCRUD(db)
    if not crud.delete_patient(patient_id, current_provider=current_provider):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        ) 
    