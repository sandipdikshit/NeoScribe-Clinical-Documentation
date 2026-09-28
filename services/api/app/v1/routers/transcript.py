from typing import List
from app.database import get_db
import app.v1.crud.transcript as crud
from sqlalchemy.orm import Session
import app.v1.schemas.transcript as schemas
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/", response_model=schemas.TranscriptCreate)
def create_transcript(
    transcript: schemas.TranscriptCreate, db: Session = Depends(get_db)
):
    return crud.create_transcript(db=db, transcript=transcript)

@router.get("/count")
def count(db: Session = Depends(get_db)):
    count = crud.count_transcripts(db)
    return JSONResponse(content={"count": count})

@router.get("/", response_model=List[schemas.TranscriptList])
def read_transcripts(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    transcripts = crud.get_transcripts(db, skip=skip, limit=limit)
    return transcripts


@router.get("/{transcript_id}", response_model=schemas.TranscriptResponse)
def read_transcript(transcript_id: int, db: Session = Depends(get_db)):
    db_transcript = crud.get_transcript(db, transcript_id=transcript_id)
    if db_transcript is None:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return db_transcript


@router.put("/{transcript_id}", response_model=schemas.TranscriptUpdate)
def update_transcript(
    transcript_id: int,
    transcript: schemas.TranscriptUpdate,
    db: Session = Depends(get_db),
):
    db_transcript = crud.update_transcript(
        db, transcript_id=transcript_id, transcript=transcript
    )
    if db_transcript is None:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return db_transcript


@router.delete("/{transcript_id}", response_model=schemas.TranscriptUpdate)
def delete_transcript(transcript_id: int, db: Session = Depends(get_db)):
    db_transcript = crud.delete_transcript(db, transcript_id=transcript_id)
    if db_transcript is None:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return db_transcript



