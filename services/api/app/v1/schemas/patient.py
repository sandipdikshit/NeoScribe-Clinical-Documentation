from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime

class PatientBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    practice_type: Optional[str] = None
    date_of_birth: Optional[date] = Field(None, example="1990-01-01")
    gender: Optional[str] = None

class PatientCreate(PatientBase):
    first_name: str
    last_name: str

class PatientUpdate(PatientBase):
    pass


class PatientInDBBase(PatientBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Patient(PatientInDBBase):
    pass

class PatientInDB(PatientInDBBase):
    pass 