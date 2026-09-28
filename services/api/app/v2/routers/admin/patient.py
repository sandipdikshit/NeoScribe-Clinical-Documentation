from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.v2.auth import get_current_provider
from sqlalchemy.orm import Session
from app.database import get_db
from app.v2.models.provider import ProviderModel
from app.v2.models.patient import (
    PatientCRUD,
    PatientCreate,
    PatientUpdate,
    PatientResponse
)
from app.role_dependency import check_permission, require_any_permission

router = APIRouter(
    prefix="/patients/v1",
    tags=["patients"]
)

@router.post("/get-patients/", 
    response_model=List[PatientResponse],
    summary="Get all patients",
    response_description="List of patient records")
async def list_patients(
    providers: List[int],
    search: Optional[str] = Query(None, description="Search by name"),
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_patient_management", "read"))
):
    """
    Retrieve a list of patients with optional filtering:
    
    - **search**: Optional search string for name
    - **min_age**: Optional minimum age filter
    - **max_age**: Optional maximum age filter
    """
    providers.append(current_provider.iUserId)
    if not providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one provider ID must be provided"
        )
    crud = PatientCRUD(db)
    providers = [provider for provider in providers]
    return crud.admin_get_patients(search=search, provider_ids=providers)

@router.get("/get-patient/{patient_id}", 
    response_model=PatientResponse,
    summary="Get a specific patient",
    response_description="The requested patient record")
async def get_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_provider= Depends(check_permission("admin_patient_management", "read"))
):
    """
    Retrieve a specific patient by their ID:
    
    - **patient_id**: The UUID of the patient to retrieve
    """
    crud = PatientCRUD(db)
    db_patient = crud.admin_get_patient(patient_id)
    if db_patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    return db_patient


@router.post("/update-patient/{patient_id}", 
    response_model=PatientResponse,
    summary="Update a patient",
    response_description="The updated patient record")
async def update_patient(
    patient_id: UUID,
    patient: PatientUpdate,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_patient_management", "update"))
):
    """
    Update a specific patient by their ID:
    
    - **patient_id**: The UUID of the patient to update
    - **patient**: The updated patient data
    """
    crud = PatientCRUD(db) 
    db_patient = crud.admin_get_patient(patient_id)
    if db_patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    try:
        return crud.admin_update_patient(
            patient_id=patient_id,
            patient=patient
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    

@router.post("/create-patient", 
    response_model=PatientResponse, 
    summary="Create a new patient",
    response_description="The created patient record")
async def create_patient(
    patient: PatientCreate,
    provider_id: int = Query(..., description="Provider ID for the patient"),
    db: Session = Depends(get_db),
    current_provider: ProviderModel = Depends(check_permission("admin_patient_management", "create"))
):
    """
    Create a new patient:

    - **patient**: The patient data to create
    """
    crud = PatientCRUD(db)
    try:
        return crud.admin_create_patient(patient, provider_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
@router.delete("/delete-patient/{patient_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a patient")
async def delete_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_provider: int = Depends(check_permission("admin_patient_management", "delete"))
):
    """
    Delete a specific patient by their ID:
    
    - **patient_id**: The UUID of the patient to delete
    """
    crud = PatientCRUD(db)
    crud.admin_delete_patient(patient_id)
    return {"message": "Patient deleted successfully"}