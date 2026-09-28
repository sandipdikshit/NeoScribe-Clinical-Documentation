import json
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, UploadFile, File, Form, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, UUID4
from sqlalchemy.orm import Session

from app.v2.services.v2_audio_handler import RealtimeTranscriptionManager
from app.v2.services.orchestrator import MedicalTranscriptionOrchestrator
from app.v2.models.note import NoteStatus, NoteType
from app.v2.models.provider import ProviderModel
from app.v2.auth import get_current_provider
from app.utils.datetime_utils import parse_datetime
from app.database import get_db

# Create router
router = APIRouter(prefix="/transcribe", tags=["transcription"])

# Singleton service instances
realtime_service = RealtimeTranscriptionManager()
orchestrator = MedicalTranscriptionOrchestrator()

# Models for API requests and responses
class TranscriptionConfig(BaseModel):
    """Configuration for transcription."""
    language: str = "en-US"

class TranscriptionResult(BaseModel):
    """Model for complete transcription results."""
    session_id: str
    text: str

class TranscriptionJobRequest(BaseModel):
    """Request model for creating a transcription job."""
    patient_id: UUID4
    visit_date: datetime
    note_type: str
    chief_complaint: str
    language: str = "en-US"
    template_id: Optional[UUID4] = None  # Optional template ID for custom templates
    template_name: Optional[str] = None  # Optional template name for custom templates

class NoteUpdateRequest(BaseModel):
    """Request model for updating a note."""
    chief_complaint: Optional[str] = None
    content: Optional[str] = None

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

@router.websocket("/ws")
async def transcribe_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time transcription."""
    # Accept the connection
    await websocket.accept()
    
    # Generate a unique session ID
    session_id = str(uuid.uuid4())
    active_connections[session_id] = websocket
    
    # Send session ID to client
    await websocket.send_json({"session_id": session_id, "status": "connected"})
    
    try:
        # Create a new transcription session
        session_result = await realtime_service.create_session(websocket, session_id)
        
        if "error" in session_result:
            await websocket.send_json({"error": session_result["error"]})
            return
            
        while True:
            # Receive data from WebSocket
            data = await websocket.receive_text()
            
            try:
                # Parse the JSON data
                json_data = json.loads(data)
                
                # Check for configuration
                if "config" in json_data:
                    config = json_data["config"]
                    if "language" in config:
                        # Close the existing session
                        await realtime_service.close_session(session_id)
                        
                        # Create a new session with the specified language
                        new_session = await realtime_service.create_session(
                            websocket, 
                            session_id, 
                            language=config["language"]
                        )
                        
                        await websocket.send_json({"status": "config_updated"})
                        continue
                
                # Check for audio data
                if "audio" in json_data:
                    # Get the session
                    session = realtime_service.get_session(session_id)
                    if not session:
                        await websocket.send_json({"error": "Session not found"})
                        break
                        
                    # Process the audio
                    result = await session.process_audio(json_data["audio"])
                    if result:
                        await websocket.send_json(result)
                
                # Check for stop command
                if json_data.get("command") == "stop":
                    # Close the session and get complete transcription
                    result = await realtime_service.close_session(session_id)
                    
                    if "error" in result:
                        await websocket.send_json(result)
                    else:
                        await websocket.send_json({
                            "status": "completed",
                            "complete_text": result.get("transcription", ""),
                            "metadata": result.get("metadata", {})
                        })
                    
                    break
                    
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON format"})
                
    except WebSocketDisconnect:
        # Clean up if client disconnects
        if session_id in active_connections:
            del active_connections[session_id]
        await realtime_service.close_session(session_id)
        
    except Exception as e:
        # Handle unexpected errors
        if session_id in active_connections:
            del active_connections[session_id]
        await realtime_service.close_session(session_id)
        await websocket.send_json({"error": f"Unexpected error: {str(e)}"})

@router.post("/submit", response_model=Dict[str, Any])
async def submit_transcription(
    transcription: TranscriptionResult,
    current_provider: ProviderModel = Depends(get_current_provider)
):
    """
    Submit complete transcription to another service/database.
    
    This endpoint receives the completed transcription from the client
    and can forward it to another service or save it to a database.
    """
    try:
        # Here you would typically process the transcription further
        # such as saving to a database or sending to another service
        
        # For this example, we'll just return a success message
        return {
            "status": "success",
            "message": "Transcription received and processed",
            "word_count": len(transcription.text.split()),
            "provider_id": str(current_provider.iUserId)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing transcription: {str(e)}")

@router.post("/upload", response_model=Dict[str, Any])
async def upload_audio_for_transcription(
    file: UploadFile = File(...),
    patient_id: uuid.UUID = Form(...),
    visit_date: str = Form(...),
    note_type: str = Form(...),
    chief_complaint: str = Form(...),
    language: str = Form("en-US"),
    template_id: Optional[uuid.UUID] = Form(None),
    template_name: Optional[str] = Form(None),
    current_provider: ProviderModel = Depends(get_current_provider)
):
    """
    Upload an audio file for transcription and note generation.
    
    Args:
        file: The audio file to transcribe
        patient_id: UUID of the patient
        visit_date: Date of the visit
        note_type: Type of note to generate (e.g., SOAP, PROGRESS)
        chief_complaint: Patient's chief complaint
        language: Language of the audio (default: en-US)
        template_id: Optional UUID of a custom template
        template_name: Optional name of a custom template
        current_provider: Current provider from auth token
    
    Returns:
        Dict containing job information
    """
    try:
        # Create transcription job
        result = await orchestrator.create_transcription_job(
            file=file,
            patient_id=patient_id,
            current_provider=current_provider,
            visit_date=parse_datetime(visit_date),
            note_type=note_type,
            chief_complaint=chief_complaint,
            language=language,
            template_id=template_id,
            template_name=template_name
        )
        return result
        
    except Exception as e:
        print(f"Error in upload_audio_for_transcription: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process audio file: {str(e)}"
        )

@router.get("/status/{note_id}", response_model=Dict[str, Any])
async def get_transcription_status(
    note_id: str,
    current_provider: ProviderModel = Depends(get_current_provider)
):
    """
    Get the current status of a transcription job.
    
    Args:
        note_id: The ID of the note to check
    """
    try:
        result = await orchestrator.get_note_status(note_id)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        # Check if the provider can access this note
        if str(result.get("provider_id")) != str(current_provider.iUserId):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this note"
            )
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking status: {str(e)}")

@router.get("/note/{note_id}", response_model=Dict[str, Any])
async def get_note_content(
    note_id: str,
    current_provider: ProviderModel = Depends(get_current_provider)
):
    """
    Get the content of a medical note.
    
    Args:
        note_id: The ID of the note to retrieve
    """
    try:
        result = await orchestrator.get_note_content(note_id)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        # Check if the provider can access this note
        if str(result.get("provider_id")) != str(current_provider.iUserId):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this note"
            )
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving note: {str(e)}")

@router.put("/note/{note_id}", response_model=Dict[str, Any])
async def update_note(
    note_id: str,
    update_data: NoteUpdateRequest,
    current_provider: ProviderModel = Depends(get_current_provider)
):
    """
    Update a medical note with new information.
    
    Args:
        note_id: The ID of the note to update
        update_data: Dictionary with fields to update (chief_complaint, content)
    """
    try:    
        # First get the note to verify ownership
        status_result = await orchestrator.get_note_status(note_id)
        
        if "error" in status_result:
            raise HTTPException(status_code=404, detail=status_result["error"])
        
        # Check if the provider can modify this note
        if str(status_result.get("provider_id")) != str(current_provider.iUserId):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to modify this note"
            )
        
        # Proceed with update
        result = await orchestrator.update_note(
            note_id=note_id,
            chief_complaint=update_data.chief_complaint,
            content=update_data.content
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating note: {str(e)}")

@router.post("/note/{note_id}/sign", response_model=Dict[str, Any])
async def sign_note(
    note_id: str,
    current_provider: ProviderModel = Depends(get_current_provider)
):
    """
    Sign a note by marking it as signed by the provider.
    
    Args:
        note_id: The ID of the note to sign
    """
    try:
        result = await orchestrator.sign_note(
            note_id=note_id,
            provider_id=str(current_provider.iUserId)
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error signing note: {str(e)}")