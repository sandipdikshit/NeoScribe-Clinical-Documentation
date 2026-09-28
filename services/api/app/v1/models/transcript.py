from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, ForeignKey, ARRAY, func
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
from datetime import datetime
from sqlalchemy.orm import Session
from typing import List, Optional
from app.v1.schemas.transcript import TranscriptCreate, TranscriptUpdate, TranscriptList



class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(20), nullable=False)
    title = Column(String(50), nullable=True)
    audio_name = Column(String(50), nullable=False)
    audio_duration = Column(Numeric, nullable=False)
    audio_filetype = Column(String(20), nullable=False)
    soap_note = Column(String(2000), nullable=True)
    text_analytics = Column(String(10000), nullable=True)
    healthcare_entities = Column(JSONB, nullable=True)  # Array of JSON objects
    key_phrases = Column(ARRAY(String), nullable=True)  # Array of strings
    extracted_summary = Column(ARRAY(String), nullable=True)  # Array of strings
    original_transcript = Column(String(10000), nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.now(), nullable=True)
    updated_at = Column(TIMESTAMP, default=datetime.now(), onupdate=datetime.now(), nullable=True)


    @classmethod
    def get_transcript(cls, db: Session, transcript_id: int):
        return db.query(cls).filter(cls.id == transcript_id).first()

    @classmethod
    def get_transcripts(cls, db: Session, skip: int = 0, limit: int = 10):
        return (
            db.query(cls).order_by(cls.created_at.desc()).offset(skip).limit(limit).all()
        )



    def create_transcript(self, db: Session, transcript: TranscriptCreate):
        self.status = transcript.status
        self.title = transcript.title
        self.audio_name = transcript.audio_name
        self.audio_duration = transcript.audio_duration
        self.audio_filetype = transcript.audio_filetype
        self.soap_note = transcript.soap_note
        self.text_analytics = transcript.text_analytics
        self.healthcare_entities = transcript.healthcare_entities
        self.key_phrases = transcript.key_phrases
        self.extracted_summary = transcript.extracted_summary
        self.original_transcript = transcript.original_transcript
        self.created_at = transcript.created_at
        self.updated_at =transcript.updated_at
        db.add(self)
        db.commit()
        db.refresh(self)
        return self


    def update_transcript(self, db: Session, transcript: TranscriptUpdate):
        transcript_data = transcript.model_dump(exclude_unset=True)
        for key, value in transcript_data.items():
            setattr(self, key, value)
        self.updated_at = datetime.now()
        db.commit()
        db.refresh(self)
        return self


    def delete_transcript(self, db: Session):
        db.delete(self)
        db.commit()
        return self

    def count_transcripts(db: Session):
        return db.query(Transcript).count()