from fastapi import File, UploadFile, Form, Depends
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
from typing import List
from sqlalchemy.orm import Session
import re

from app.v1.services.analytics_handler import analyze_document, Result

from app.v1.services.audio_handler import upload_audio, transcribe_audio
from app.v1.services.genai_handler import generate_soap_note
from app.v1.crud.transcript import create_transcript
from app.v1.schemas.transcript import TranscriptCreate
from app.database import get_db

router = APIRouter()


# Main route
@router.get("/", response_class=JSONResponse)
async def get_form():
    return {"message": "Please use the POST endpoint to analyze text."}


# Post route to analyze text
@router.post("/analyze_text", response_class=JSONResponse)
async def analyze(text: str = Form(...)):

    results: List[Result] = analyze_document([text])

    if results:
        result = results[0]

    return JSONResponse(result.to_dict())


@router.post("/upload_audio")
async def upload_audio_handler(file: UploadFile = File(...)):
    # Validate file MIME type
    response = await upload_audio(file)

    return JSONResponse(response)


@router.post("/transcribe_audio")
async def transcribe(sas_url: str = Form(...)):
    response = await transcribe_audio(sas_url)
    return JSONResponse(response)


@router.post("/generate_note")
async def generate_note(text: str = Form(...)):
    note = await generate_soap_note(text)
    return JSONResponse({"note": note})


@router.post("/process_audio")
async def process_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Save audio and get SAS URL
    file_upload_response = await upload_audio(file)
    sas_url = file_upload_response.get("sas_url")

    # Get transcription
    transcription_response = transcribe_audio(sas_url)
    transcript = transcription_response.get("combinedRecognizedPhrases")[0].get(
        "lexical"
    )

    # Analyze text and generate SOAP note
    analyze_response: List[Result] = analyze_document([transcript])
    summary = analyze_response[0].abstract_summary[0]
    key_phrases = analyze_response[0].key_phrases
    healthcare_entities = analyze_response[0].healthcare_entities
    extracted_summary = analyze_response[0].extracted_summary

    # Generate SOAP note
    note_response = await generate_soap_note(summary) 
    soap_note_content = note_response["choices"][0]["message"]["content"]

    # Fix title length - truncate to 50 chars if needed
    title = (
        (extracted_summary[0][:47] + "...")
        if len(extracted_summary[0]) > 50
        else extracted_summary[0]
    )

    # Fix duration - convert from string format to decimal
    duration_str = transcription_response.get("duration", "PT0S")
    # Extract numeric value from format like "PT4M15.6081875S"
    duration_match = re.search(r"PT(?:(\d+)M)?(\d+\.?\d*)S", duration_str)
    if duration_match:
        minutes = float(duration_match.group(1) or 0)
        seconds = float(duration_match.group(2))
        duration = minutes * 60 + seconds
    else:
        duration = 0.0

    # Fix healthcare_entities - convert list to dict with index as key
    entities_dict = (
        {str(idx): entity for idx, entity in enumerate(healthcare_entities)}
        if healthcare_entities
        else {}
    )

    # Create transcript record with fixed fields
    transcript_data = TranscriptCreate(
        status="completed",
        title=title,
        audio_name=file.filename,
        audio_duration=duration,
        audio_filetype=file.content_type,
        soap_note=soap_note_content,
        text_analytics=summary,
        healthcare_entities=entities_dict,  # Now a dictionary
        key_phrases=key_phrases,
        extracted_summary=extracted_summary,
        original_transcript=transcript,
    )

    # Store in database
    db_transcript = create_transcript(db, transcript_data)

    return JSONResponse(
        {
            "note": soap_note_content,
            "transcript_id": db_transcript.id,
            "status": db_transcript.status,
        }
    )
