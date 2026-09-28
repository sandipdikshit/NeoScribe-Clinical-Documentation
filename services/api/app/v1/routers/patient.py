from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db


import app.v1.crud.patient as crud
import app.v1.schemas.patient as schema
from app.v1.models.patient import Patient

router = APIRouter()


# > Create Patient
@router.post("/", response_model=schema.Patient)
def create_patient(patient: schema.PatientCreate, db: Session = Depends(get_db)):
    db_patient = crud.get_by_email(db, email=patient.email)
    if db_patient:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create(db=db, patient=patient)


# > Get Patient by ID
@router.get("/{patient_id}", response_model=schema.Patient)
def read_patient(patient_id: int, db: Session = Depends(get_db)):
    db_patient = Patient.get(db, patient_id=patient_id)
    if db_patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return db_patient




# > Update Patient
@router.put("/{patient_id}", response_model=schema.Patient)
def update_patient(patient_id: int, patient: schema.PatientUpdate, db: Session = Depends(get_db)):
    db_patient = crud.get(db, patient_id=patient_id)
    if db_patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return crud.update(db=db, db_patient=db_patient, patient=patient)


# > Delete Patient
@router.delete("/{patient_id}", response_model=schema.Patient)
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    db_patient = crud.get(db, patient_id=patient_id)
    if db_patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return crud.delete(db=db, patient_id=patient_id)


# ! Admin routes


# > Get All Patients
@router.get("/", response_model=List[schema.Patient])
def read_patients(db: Session = Depends(get_db)):
    patients = crud.get_all(db)
    return patients


# > Create Patients in Bulk
@router.post("/bulk", response_model=List[schema.Patient])
def create_bulk_patients(patients: List[schema.PatientCreate], db: Session = Depends(get_db)):
    created_patients = crud.create_bulk(db=db, patients=patients)
    return created_patients            
