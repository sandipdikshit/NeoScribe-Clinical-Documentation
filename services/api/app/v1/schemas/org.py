from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime


class OrgBase(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    address : Optional[str] = None
    phone_number: Optional[str] = None



class OrgCreate(OrgBase):
    name: str
    email: EmailStr
    address : str
    phone_number: str


class OrgUpdate(OrgBase):
    pass


class OrgInDBBase(OrgBase):
    orgid: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Org(OrgInDBBase):
    pass


class OrgInDB(OrgInDBBase):
    pass
