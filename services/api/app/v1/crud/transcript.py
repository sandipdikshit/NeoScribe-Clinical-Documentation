from sqlalchemy.orm import Session
from typing import List, Optional
from app.v1.models.transcript import Transcript
from app.v1.schemas.transcript import TranscriptCreate, TranscriptUpdate, TranscriptList


def get_transcript(db: Session, transcript_id: int) -> Optional[Transcript]:
    return db.query(Transcript).filter(Transcript.id == transcript_id).first()


def get_transcripts(
    db: Session, skip: int = 0, limit: int = 10
) -> List[TranscriptList]:
    return (
        db.query(Transcript)
        .order_by(Transcript.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_transcript(
    db: Session, transcript: TranscriptCreate
) -> Optional[Transcript]:
    db_transcript = Transcript(**transcript.dict())
    db.add(db_transcript)
    db.commit()
    db.refresh(db_transcript)
    return db_transcript


def update_transcript(
    db: Session, transcript_id: int, transcript: TranscriptUpdate
) -> Optional[Transcript]:
    db_transcript = (
        db.query(Transcript)
        .filter(Transcript.id == transcript_id)
        .first()
    )
    if db_transcript:
        for key, value in transcript.dict().items():
            setattr(db_transcript, key, value)
        db.commit()
        db.refresh(db_transcript)
    return db_transcript


def delete_transcript(
    db: Session, transcript_id: int
) -> Optional[Transcript]:
    db_transcript = (
        db.query(Transcript)
        .filter(Transcript.id == transcript_id)
        .first()
    )
    if db_transcript:
        db.delete(db_transcript)
        db.commit()
    return db_transcript

def count_transcripts(db: Session):
    return db.query(Transcript).count()