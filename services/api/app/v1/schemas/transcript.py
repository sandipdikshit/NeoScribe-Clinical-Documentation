from pydantic import BaseModel, constr
from decimal import Decimal
from datetime import datetime
from typing import Optional, List


class TranscriptBase(BaseModel):
    status: constr(max_length=20)
    title: Optional[constr(max_length=50)] = None
    audio_name: constr(max_length=50)
    audio_duration: Decimal
    audio_filetype: constr(max_length=20)
    soap_note: Optional[constr(max_length=2000)] = None
    text_analytics: Optional[constr(max_length=10000)] = None
    healthcare_entities: Optional[dict] = None  # JSONB type
    key_phrases: Optional[List[str]] = None  # Array of strings
    extracted_summary: Optional[List[str]] = None  # Array of strings
    original_transcript: Optional[constr(max_length=10000)] = None


class TranscriptCreate(TranscriptBase):
    pass


class TranscriptUpdate(BaseModel):
    status: Optional[constr(max_length=20)] = None
    title: Optional[constr(max_length=50)] = None
    audio_name: Optional[constr(max_length=50)] = None
    audio_duration: Optional[Decimal] = None
    audio_filetype: Optional[constr(max_length=20)] = None
    soap_note: Optional[constr(max_length=2000)] = None
    text_analytics: Optional[constr(max_length=10000)] = None
    healthcare_entities: Optional[dict] = None
    key_phrases: Optional[List[str]] = None
    extracted_summary: Optional[List[str]] = None
    original_transcript: Optional[constr(max_length=10000)] = None


class TranscriptInDB(TranscriptBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TranscriptResponse(TranscriptInDB):
    pass


class TranscriptList(BaseModel):
    id: int
    status: str
    title: Optional[str]
    created_at: datetime
    key_phrases: Optional[List[str]]
    
    class Config:
        from_attributes = True