from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime

class UserBase(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    practice_type: Optional[str] = None
    orgid: Optional[int] = None
    date_of_birth: Optional[date] = Field(None, example="1990-01-01")
    gender: Optional[str] = None


class UserCreate(UserBase):
    username: str
    first_name: str
    last_name: str



class UserUpdate(UserBase):
    pass

class UserInDBBase(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    pass