"""
Real-time transcription WebSocket service with pause/resume functionality.

Pause/Resume Feature:
- Send {"type": "transcription_pause"} to pause transcription and recording
- Send {"type": "transcription_resume"} to resume transcription and recording
- When paused, no audio is processed or sent to Deepgram
- When paused, no transcript results are sent to the frontend
- The connection remains active during pause/resume operations
- KeepAlive messages are sent periodically during pause to prevent Deepgram timeout
"""

import os
import uuid
import json
import asyncio
import wave
import tempfile
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, UploadFile, File, Form, status
from deepgram import DeepgramClient, LiveTranscriptionEvents, LiveOptions
from pydantic import BaseModel, UUID4
from jose import jwt, JWTError
import logging
from contextlib import asynccontextmanager

from app.v2.models.note import NoteType
from app.v2.models.provider import ProviderModel
from app.v2.routers.provider import get_current_provider
from app.v2.services.orchestrator import MedicalTranscriptionOrchestrator

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/transcribe", tags=["transcription_websocket"])

# Singleton orchestrator
orchestrator = MedicalTranscriptionOrchestrator()

# Deepgram API key
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Store active connections with provider info
class ConnectionInfo:
    def __init__(self, websocket: WebSocket, provider: ProviderModel, session_id: str):
        self.websocket = websocket
        self.provider = provider
        self.session_id = session_id
        self.authenticated = False
        self.patient_details = {}
        self.audio_buffer = []
        self.audio_metadata = {
            "start_time": datetime.now(),
            "sample_rate": 16000,
            "channels": 1,
            "sample_width": 2,
            "duration": 0.0,
            "byte_count": 0
        }
        self.audio_processed = False  # Track if audio has been processed
        self.is_paused = False  # Track pause/resume state
        self.keepalive_task = None  # Track keepalive task during pause

active_connections: Dict[str, ConnectionInfo] = {}

class TranscriptionResult(BaseModel):
    session_id: str
    text: str

class NoteUpdateRequest(BaseModel):
    chief_complaint: Optional[str] = None
    content: Optional[str] = None

class PatientDetails(BaseModel):
    chief_complaint: Optional[str] = None
    patient_id: Optional[str] = None
    visit_date: Optional[str] = None
    note_type: Optional[str] = None
    template_id: Optional[str] = None
    language: Optional[str] = "en-US"

def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        return None

async def get_provider_from_token(token: str, db) -> Optional[ProviderModel]:
    """Get provider from JWT token"""
    payload = verify_token(token)
    if not payload:
        logger.error("Invalid token")
        return None
    
    provider_id = payload.get("id")
    if not provider_id:
        logger.error("Provider ID not found in token")
        return None
    
    provider = db.query(ProviderModel).filter(
        ProviderModel.iUserId == provider_id,
        ProviderModel.tiStatus == 1
    ).first()
    
    if not provider:
        logger.error(f"Provider not found or inactive: {provider_id}")
        return None
    
    return provider

async def send_periodic_keepalive(dg_connection, connection_info):
    """Send periodic KeepAlive messages to Deepgram during pause to prevent timeout"""
    try:
        while connection_info.is_paused and not connection_info.keepalive_task.cancelled():
            await asyncio.sleep(10)  # Send KeepAlive every 10 seconds
            if connection_info.is_paused:
                await dg_connection.send(json.dumps({"type": "KeepAlive"}))
                logger.debug(f"Sent KeepAlive for paused session {connection_info.session_id}")
    except asyncio.CancelledError:
        logger.debug(f"KeepAlive task cancelled for session {connection_info.session_id}")
    except Exception as e:
        logger.error(f"Error in KeepAlive task for session {connection_info.session_id}: {e}")

def create_wav_file(audio_chunks: List[bytes], sample_rate: int = 16000, channels: int = 1, sample_width: int = 2) -> bytes:
    """Create a WAV file from raw PCM audio chunks."""
    combined_audio = b''.join(audio_chunks)
    wav_buffer = BytesIO()
    
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(combined_audio)
    
    wav_buffer.seek(0)
    return wav_buffer.read()

@asynccontextmanager
async def create_temp_upload_file(audio_data: bytes, filename: str):
    """Create a temporary UploadFile object from audio data with automatic cleanup."""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
    temp_path = temp_file.name
    
    try:
        # Write audio data to temp file
        temp_file.write(audio_data)
        temp_file.close()
        
        # Create UploadFile with file handle
        file_handle = open(temp_path, 'rb')
        upload_file = UploadFile(filename=filename, file=file_handle)        
        yield upload_file
        
    finally:
        # Cleanup
        try:
            file_handle.close()
        except:
            pass
        
        try:
            os.unlink(temp_path)
        except:
            pass

@router.websocket("/ws")
async def transcribe_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time transcription using Deepgram."""
    await websocket.accept()
    
    session_id = str(uuid.uuid4())
    connection_info = None
    dg_connection = None
    authenticated = False
    connection_closing = False
    process_cancel = False
    
    logger.info(f"WebSocket connection accepted: {session_id}")
    
    # Define safe send function
    async def safe_send_json(data: dict) -> bool:
        """Safely send JSON data to websocket"""
        if connection_closing:
            return False
        
        try:
            await websocket.send_json(data)
            return True
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return False
    
    try:
        # Set authentication timeout (10 seconds)
        auth_timeout = 10.0
        
        # Wait for authentication message
        try:
            auth_message = await asyncio.wait_for(
                websocket.receive_json(),
                timeout=auth_timeout
            )
        except asyncio.TimeoutError:
            logger.warning(f"Authentication timeout for session {session_id}")
            await safe_send_json({
                "type": "auth_failed",
                "message": "Authentication timeout. Please send auth message within 10 seconds."
            })
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Verify authentication message
        if auth_message.get("type") != "auth":
            logger.warning(f"Invalid first message type for session {session_id}: {auth_message.get('type')}")
            await safe_send_json({
                "type": "auth_failed",
                "message": "First message must be authentication"
            })
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        token = auth_message.get("token")
        if not token:
            logger.warning(f"No token provided for session {session_id}")
            await safe_send_json({
                "type": "auth_failed",
                "message": "Authentication token required"
            })
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Verify token and get provider
        from app.database import get_db
        db = next(get_db())
        
        try:
            provider = await get_provider_from_token(token, db)
            if not provider:
                logger.warning(f"Invalid token or provider not found for session {session_id}")
                await safe_send_json({
                    "type": "auth_failed",
                    "message": "Invalid authentication token"
                })
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            # Authentication successful
            authenticated = True
            connection_info = ConnectionInfo(websocket, provider, session_id)
            connection_info.authenticated = True
            active_connections[session_id] = connection_info
            
            logger.info(f"Authentication successful for provider {provider.iUserId}, session {session_id}")
            
            # Send success message
            await safe_send_json({
                "type": "auth_success",
                "session_id": session_id,
                "provider_id": str(provider.iUserId),
                "message": "Authentication successful"
            })
            
        finally:
            db.close()
        
        # Create Deepgram client
        deepgram = DeepgramClient(DEEPGRAM_API_KEY)
        dg_connection = deepgram.listen.asyncwebsocket.v("1")
        
        # Define Deepgram event handlers
        async def on_message(self, result, **kwargs):
            try:
                if connection_closing or connection_info.is_paused:
                    return
                    
                if not result.channel or not result.channel.alternatives:
                    return
                    
                alternative = result.channel.alternatives[0]
                transcript_text = alternative.transcript
                
                if transcript_text and len(transcript_text.strip()) > 0:
                    response = {
                        "type": "transcript",
                        "text": transcript_text,
                        "isFinal": result.is_final,
                        "timestamp": datetime.now().isoformat(),
                        "speaker": None,
                        "words": []
                    }
                    
                    if hasattr(alternative, 'words') and alternative.words:
                        for word in alternative.words:
                            word_data = {
                                "word": word.word,
                                "start": word.start,
                                "end": word.end,
                                "confidence": getattr(word, 'confidence', 1.0)
                            }
                            
                            if hasattr(word, 'speaker'):
                                word_data["speaker"] = word.speaker
                            
                            response["words"].append(word_data)
                    
                    await safe_send_json(response)
                    
            except Exception as e:
                logger.error(f"Error processing transcript: {e}")

        async def on_error(self, error, **kwargs):
            logger.error(f"Deepgram error: {error}")
            await safe_send_json({
                "type": "error",
                "message": f"Transcription error: {str(error)}"
            })

        # Register event handlers
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)

        # Configure Deepgram options
        options = LiveOptions(
            model="nova-3-medical",
            language="en-US",
            smart_format=True,
            punctuate=True,
            profanity_filter=False,
            interim_results=True,
            utterance_end_ms=1000,
            vad_events=False,
            diarize=True,
            channels=1,
            encoding="linear16",
            sample_rate=16000
        )

        # Start Deepgram connection
        if await dg_connection.start(options):
            logger.info(f"Deepgram connection started for session {session_id}")
        else:
            raise Exception("Failed to start Deepgram connection")

        # Main message loop
        while authenticated and not connection_closing:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=30.0)
                
                if "text" in message:
                    try:
                        data = json.loads(message["text"])
                        message_type = data.get("type", "")
                        
                        if message_type == "config":
                            # Configuration already handled during auth
                            await safe_send_json({
                                "type": "config_ack",
                                "message": "Configuration received"
                            })
                            
                        elif message_type == "ping":
                            await safe_send_json({"type": "pong"})
                            
                        elif message_type == "patient_details":
                            patient_data = data.get("patient", {})
                            connection_info.patient_details = {
                                "chief_complaint": patient_data.get("chief_complaint"),
                                "patient_id": patient_data.get("patient_id"),
                                "template_id": patient_data.get("template_id"),
                                "visit_date": patient_data.get("visit_date"),
                                "note_type": patient_data.get("note_type"),
                                "language": patient_data.get("language", "en-US")
                            }
                            
                            logger.info(f"Patient details updated for session {session_id}")
                            
                            await safe_send_json({
                                "type": "patient_details_ack",
                                "message": "Patient details received and stored",
                                "patient_details": connection_info.patient_details
                            })
                            
                        elif message_type == "audio_start":
                            logger.info(f"Audio streaming started for session {session_id}")
                            
                        elif message_type == "audio_cancel":
                            logger.info(f"Audio streaming cancelled for session {session_id}")
                            # Set connection_closing to stop processing
                            connection_closing = True
                            process_cancel = True
                            break
                            
                        elif message_type == "transcription_pause":
                            logger.info(f"Transcription paused for session {session_id}")
                            connection_info.is_paused = True
                            
                            # Start periodic KeepAlive task to prevent Deepgram timeout
                            if connection_info.keepalive_task is None or connection_info.keepalive_task.done():
                                connection_info.keepalive_task = asyncio.create_task(
                                    send_periodic_keepalive(dg_connection, connection_info)
                                )
                            
                            await safe_send_json({
                                "type": "transcription_paused",
                                "message": "Transcription and recording paused",
                                "timestamp": datetime.now().isoformat()
                            })
                            
                        elif message_type == "transcription_resume":
                            logger.info(f"Transcription resumed for session {session_id}")
                            connection_info.is_paused = False
                            
                            # Cancel KeepAlive task since we're resuming
                            if connection_info.keepalive_task and not connection_info.keepalive_task.done():
                                connection_info.keepalive_task.cancel()
                                try:
                                    await connection_info.keepalive_task
                                except asyncio.CancelledError:
                                    pass
                            
                            await safe_send_json({
                                "type": "transcription_resumed",
                                "message": "Transcription and recording resumed",
                                "timestamp": datetime.now().isoformat()
                            })
                            
                        elif message_type == "audio_end":
                            logger.info(f"Audio streaming ended for session {session_id}")
                            
                            # Finalize Deepgram transcription
                            await dg_connection.send(json.dumps({"type": "Finalize"}))
                            
                            await safe_send_json({
                                "type": "audio_ended",
                                "message": "Audio streaming ended, transcription finalized"
                            })
                            
                            # Process audio and create transcription job BEFORE setting connection_closing
                            if connection_info.audio_buffer:
                                try:
                                    wav_data = create_wav_file(
                                        connection_info.audio_buffer,
                                        sample_rate=connection_info.audio_metadata["sample_rate"],
                                        channels=connection_info.audio_metadata["channels"],
                                        sample_width=connection_info.audio_metadata["sample_width"]
                                    )
                                    
                                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                                    filename = f"recording_{session_id}_{timestamp}.wav"
                                    
                                    patient_data = connection_info.patient_details
                                    
                                    if all([
                                        patient_data.get("patient_id"),
                                        patient_data.get("visit_date"),
                                        patient_data.get("note_type"),
                                        patient_data.get("chief_complaint")
                                    ]):
                                        from app.utils.datetime_utils import parse_datetime
                                        visit_date = parse_datetime(patient_data["visit_date"])
                                        
                                        # Use the async context manager for proper cleanup
                                        async with create_temp_upload_file(wav_data, filename) as mock_file:
                                            result = await orchestrator.create_transcription_job(
                                                file=mock_file,
                                                patient_id=uuid.UUID(patient_data["patient_id"]),
                                                current_provider=connection_info.provider,
                                                visit_date=visit_date,
                                                note_type=patient_data["note_type"],
                                                chief_complaint=patient_data["chief_complaint"],
                                                language=patient_data.get("language", "en-US"),
                                                template_id=patient_data.get("template_id"),
                                            )
                                            
                                            # Only send success message if connection is still open
                                            if not connection_closing:
                                                await safe_send_json({
                                                    "type": "transcription_job_created",
                                                    "message": "Transcription job created successfully",
                                                    "filename": filename,
                                                    "patient_id": patient_data["patient_id"],
                                                    "job_result": result
                                                })
                                            
                                            logger.info(f"Transcription job created for session {session_id}")
                                            connection_info.audio_processed = True  # Mark as processed
                                        
                                except Exception as e:
                                    logger.error(f"Error creating transcription job: {e}")
                                    # Only send error message if connection is still open
                                    if not connection_closing:
                                        await safe_send_json({
                                            "type": "error",
                                            "message": f"Failed to create transcription job: {str(e)}"
                                        })
                            
                            # Send a final completion message before closing
                            await safe_send_json({
                                "type": "processing_complete",
                                "message": "All processing completed, connection will close"
                            })

                            # Set connection_closing AFTER processing is complete
                            connection_closing = True
                            
                    except json.JSONDecodeError:
                        if len(message["text"]) > 0:
                            await dg_connection.send(message["text"].encode())
                
                elif "bytes" in message:
                    if len(message["bytes"]) > 0 and not connection_info.is_paused:
                        connection_info.audio_buffer.append(message["bytes"])
                        connection_info.audio_metadata["byte_count"] += len(message["bytes"])
                        await dg_connection.send(message["bytes"])
                        
            except asyncio.TimeoutError:
                await safe_send_json({"type": "keepalive"})
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected: {session_id}")
                break
            except Exception as e:
                logger.error(f"Error in message loop: {e}")
                break
                
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
        import traceback
        traceback.print_exc()
        
        try:
            await safe_send_json({
                "type": "error",
                "message": f"Connection error: {str(e)}"
            })
        except:
            pass
    
    finally:
        connection_closing = True
        
        # Process audio if connection breaks unexpectedly and we have audio data that hasn't been processed
        if (connection_info and connection_info.audio_buffer and authenticated and 
            not connection_info.audio_processed and 
            connection_info.audio_metadata["byte_count"] > 32000 and
            not process_cancel):  # At least 1 second of audio (16kHz * 2 bytes)
            logger.info(f"Processing audio from broken connection for session {session_id}")
            logger.info(f"Audio buffer size: {len(connection_info.audio_buffer)} chunks, total bytes: {connection_info.audio_metadata['byte_count']}")
            try:
                wav_data = create_wav_file(
                    connection_info.audio_buffer,
                    sample_rate=connection_info.audio_metadata["sample_rate"],
                    channels=connection_info.audio_metadata["channels"],
                    sample_width=connection_info.audio_metadata["sample_width"]
                )
                
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"recording_{session_id}_{timestamp}_broken.wav"
                
                patient_data = connection_info.patient_details
                
                # Only process if we have minimal required patient data
                if patient_data.get("patient_id") and patient_data.get("visit_date") and patient_data.get("note_type"):
                    # Use fallback chief complaint if not provided
                    chief_complaint = patient_data.get("chief_complaint")
                    if not chief_complaint:
                        chief_complaint = "Connection broken - audio recovered from unexpected disconnection"
                    from app.utils.datetime_utils import parse_datetime
                    visit_date = parse_datetime(patient_data["visit_date"])
                    
                    # Use the async context manager for proper cleanup
                    async with create_temp_upload_file(wav_data, filename) as mock_file:
                        result = await orchestrator.create_transcription_job(
                            file=mock_file,
                            patient_id=uuid.UUID(patient_data["patient_id"]),
                            current_provider=connection_info.provider,
                            visit_date=visit_date,
                            note_type=patient_data["note_type"],
                            chief_complaint=chief_complaint,
                            language=patient_data.get("language", "en-US"),
                            template_id=patient_data.get("template_id"),
                        )
                        
                        logger.info(f"Transcription job created from broken connection for session {session_id}")
                        
            except Exception as e:
                logger.error(f"Error creating transcription job from broken connection: {e}")
        else:
            if connection_info:
                logger.info(f"Skipping audio processing for session {session_id}: audio_processed={getattr(connection_info, 'audio_processed', False)}, buffer_size={len(connection_info.audio_buffer) if connection_info.audio_buffer else 0}, bytes={connection_info.audio_metadata.get('byte_count', 0) if connection_info.audio_metadata else 0}")
        
        # Cleanup
        logger.info(f"Cleaning up session: {session_id}")
        
        # Cancel KeepAlive task if it exists
        if connection_info and connection_info.keepalive_task and not connection_info.keepalive_task.done():
            connection_info.keepalive_task.cancel()
            try:
                await connection_info.keepalive_task
            except asyncio.CancelledError:
                pass
        
        if session_id in active_connections:
            del active_connections[session_id]
        
        if dg_connection:
            try:
                await dg_connection.finish()
                logger.info(f"Deepgram connection closed for session {session_id}")
            except:
                pass
        
        try:
            await websocket.close()
        except:
            pass

# Rest of your endpoints remain the same...
@router.post("/submit", response_model=Dict[str, Any])
async def submit_transcription(
    transcription: TranscriptionResult,
    current_provider: ProviderModel = Depends(get_current_provider)
):
    try:
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
    try:
        if not file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="Invalid file type. Only audio files are allowed.")
        
        result = await orchestrator.create_transcription_job(
            file=file,
            patient_id=patient_id,
            current_provider=current_provider,
            visit_date=visit_date,
            note_type=note_type,
            chief_complaint=chief_complaint,
            language=language,
            template_id=template_id,
            template_name=template_name
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process audio file: {str(e)}")

@router.get("/status/{note_id}", response_model=Dict[str, Any])
async def get_transcription_status(
    note_id: str,
    current_provider: ProviderModel = Depends(get_current_provider)
):
    try:
        result = await orchestrator.get_note_status(note_id)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        if str(result.get("provider_id")) != str(current_provider.iUserId):
            raise HTTPException(status_code=403, detail="You do not have permission to access this note")
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
    try:
        result = await orchestrator.get_note_content(note_id)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        if str(result.get("provider_id")) != str(current_provider.iUserId):
            raise HTTPException(status_code=403, detail="You do not have permission to access this note")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving note: {str(e)}")