# app/crud/patient.py
"""
This module contains the CRUD operations for the Patient model
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.v1.models.patient import Patient
from app.v1.schemas.patient import PatientCreate, PatientUpdate
from datetime import datetime


# > Get Patient by ID
def get(db: Session, patient_id: int):
    return db.query(Patient).filter(Patient.id == patient_id).first()


# > Get Patient by Email
def get_by_email(db: Session, email: str):
    return db.query(Patient).filter(Patient.email == email).first()


# def get_with_filters(
#     db: Session,
#     username: Optional[str] = None,
#     email: Optional[str] = None,
#     first_name: Optional[str] = None,
#     last_name: Optional[str] = None,
#     created_at: Optional[datetime] = None,
#     updated_at: Optional[datetime] = None,
#     offset: int = 0,
#     limit: int = 100,
# ) -> List[User]:
#     query = db.query(User)

#     if username:
#         query = query.filter(User.username == username)
#     if email:
#         query = query.filter(User.email == email)
#     if first_name:
#         query = query.filter(User.first_name == first_name)
#     if last_name:
#         query = query.filter(User.last_name == last_name)

#     query = query.offset(offset).limit(limit)
#     users = query.all()

#     return users


# > Create patient
def create(db: Session, patient: PatientCreate):
    db_patient = Patient(
        first_name=patient.first_name,
        last_name=patient.last_name,
        email=patient.email,
        phone_number=patient.phone_number,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


# > Update patient
def update(db: Session, db_patient: Patient, patient: PatientUpdate):
    patient_data = patient.model_dump(exclude_unset=True)
    for key, value in patient_data.items():
        setattr(db_patient, key, value)
    db_patient.updated_at = datetime.now()
    db.commit()
    db.refresh(db_patient)
    return db_patient


# > Delete Patient
def delete(db: Session, patient_id: int):
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if db_patient:
        db.delete(db_patient)
        db.commit()
        return db_patient


# ! Admin CRUD Operations


# > Get all Patients
def get_all(db: Session) -> List[Patient]:
    return db.query(Patient).all()


# > Create Patients in Bulk
def create_bulk(db: Session, patients: List[PatientCreate]):
    emails = [patient.email for patient in patients]
    existing_patient = db.query(Patient).filter(Patient.email.in_(emails)).all()
    existing_emails = {patient.email for patient in existing_patient}
    new_patients = [patient for patient in patients if patient.email not in existing_emails]
    if not new_patients:
        return "All patients already exist"
    db_patients = [
        Patient(
            first_name=patient.first_name,
            last_name=patient.last_name,
            email=patient.email,
            phone_number=patient.phone_number,
            date_of_birth=patient.date_of_birth,
            gender=patient.gender,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        for patient in new_patients
    ]
    db.add_all(db_patients)
    db.commit()
    for db_patient in db_patients:
        db.refresh(db_patient)
    return db_patients

