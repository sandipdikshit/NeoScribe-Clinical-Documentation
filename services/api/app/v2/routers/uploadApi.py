# upload_api.py - FastAPI backend example
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.params import Depends
from fastapi.responses import JSONResponse
import os
import aiofiles
import asyncio
from typing import Dict, Optional
import uuid
from datetime import datetime, timedelta
import shutil
from pathlib import Path
from sqlalchemy.orm import Session

from app.v2.models.provider import ProviderModel
from app.v2.services.orchestrator import MedicalTranscriptionOrchestrator
from app.utils.datetime_utils import parse_datetime

from app.v2.auth import get_current_provider

router = APIRouter(prefix="/upload", tags=["file_upload"])

# Storage for upload sessions
upload_sessions: Dict[str, dict] = {}

# Configuration
UPLOAD_DIR = Path("uploads")
TEMP_DIR = Path("temp_uploads")
CHUNK_SIZE = 20 * 1024 * 1024  # 1MB
SESSION_TIMEOUT = timedelta(hours=2)

# Create directories if they don't exist
UPLOAD_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

orchestrator = MedicalTranscriptionOrchestrator()


class UploadSession:
    def __init__(self, session_id: str, file_name: str, file_size: int, 
                 total_chunks: int, metadata: dict):
        self.session_id = session_id
        self.file_name = file_name
        self.file_size = file_size
        self.total_chunks = total_chunks
        self.chunks_received = set()
        self.temp_path = TEMP_DIR / f"{session_id}_{file_name}"
        self.created_at = datetime.now()
        self.metadata = metadata
        self.lock = asyncio.Lock()


@router.post("/initialize")
async def initialize_upload(
    fileName: str = Form(...),
    fileSize: int = Form(...),
    fileType: str = Form(...),
    totalChunks: int = Form(...),
    chiefComplaint: str = Form(...),
    patientId: str = Form(...),
    visitDate: str = Form(...),
    noteType: str = Form(...),
    template: str = Form(...),
    currentProvider: ProviderModel = Depends(get_current_provider),
):
    """Initialize a new upload session"""
    try:
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        
        # Create upload session
        session = UploadSession(
            session_id=session_id,
            file_name=fileName,
            file_size=fileSize,
            total_chunks=totalChunks,
            metadata={
                "chiefComplaint": chiefComplaint,
                "patientId": patientId,
                "visitDate": visitDate,
                "noteType": noteType,
                "template": template,
                "fileType": fileType,
                "filename": fileName,
                "currentProvider": currentProvider
            }
        )
        
        # Store session
        upload_sessions[session_id] = session
        
        # Create empty file
        async with aiofiles.open(session.temp_path, 'wb') as f:
            await f.write(b'')
        
        return JSONResponse({
            "sessionId": session_id,
            "message": "Upload session initialized"
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chunk")
async def upload_chunk(
    chunk: UploadFile = File(...),
    sessionId: str = Form(...),
    chunkIndex: int = Form(...),
    totalChunks: int = Form(...)
):
    """Upload a single chunk"""
    try:
        # Get session
        session = upload_sessions.get(sessionId)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Check if session is expired
        if datetime.now() - session.created_at > SESSION_TIMEOUT:
            raise HTTPException(status_code=410, detail="Session expired")
        
        # Read chunk data
        chunk_data = await chunk.read()
        
        # Write chunk to file at correct position
        async with session.lock:
            async with aiofiles.open(session.temp_path, 'r+b') as f:
                await f.seek(chunkIndex * CHUNK_SIZE)
                await f.write(chunk_data)
            
            # Track received chunks
            session.chunks_received.add(chunkIndex)
        
        return JSONResponse({
            "chunkIndex": chunkIndex,
            "received": len(session.chunks_received),
            "total": session.total_chunks
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/finalize")
async def finalize_upload(
    background_tasks: BackgroundTasks,
    sessionId: str = Form(...)
):
    """Finalize the upload and process the file"""
    try:
        # Get session
        session = upload_sessions.get(sessionId)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify all chunks received
        if len(session.chunks_received) != session.total_chunks:
            missing_chunks = set(range(session.total_chunks)) - session.chunks_received
            raise HTTPException(
                status_code=400, 
                detail=f"Missing chunks: {list(missing_chunks)}"
            )
        
        # Move file to final location
        final_path = UPLOAD_DIR / f"{session.session_id}_{session.file_name}"
        shutil.move(str(session.temp_path), str(final_path))
        
        # Add background task for processing
        background_tasks.add_task(
            process_audio_file,
            file_path=final_path,
            metadata=session.metadata
        )
        
        # Clean up session
        del upload_sessions[sessionId]
        
        return JSONResponse({
            "message": "Upload completed successfully",
            "fileId": session.session_id
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{session_id}")
async def get_upload_status(session_id: str):
    """Get the status of an upload session"""
    session = upload_sessions.get(session_id)
    if not session:
        return JSONResponse({"status": "not_found"})
    
    return JSONResponse({
        "status": "in_progress",
        "chunksReceived": len(session.chunks_received),
        "totalChunks": session.total_chunks,
        "progress": (len(session.chunks_received) / session.total_chunks) * 100
    })


@router.delete("/cancel/{session_id}")
async def cancel_upload(session_id: str):
    """Cancel an upload session"""
    session = upload_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete temp file
    if session.temp_path.exists():
        os.remove(session.temp_path)
    
    # Remove session
    del upload_sessions[session_id]
    
    return JSONResponse({"message": "Upload cancelled"})


async def process_audio_file(file_path: Path, metadata: dict):
    """Background task to process the uploaded audio file"""
    try:
        import uuid
        from fastapi import UploadFile
        
        # Create a mock UploadFile object from the file path
        with open(file_path, 'rb') as file:
            file_content = file.read()
        
        # Create a mock UploadFile object with proper file-like interface
        class MockFile:
            def __init__(self, content):
                self.content = content
                self.position = 0
            
            def read(self, size=None):
                if size is None:
                    result = self.content[self.position:]
                    self.position = len(self.content)
                    return result
                else:
                    result = self.content[self.position:self.position + size]
                    self.position += size
                    return result
            
            def seek(self, position):
                self.position = position
            
            def close(self):
                pass
        
        # Create a mock UploadFile with async seek method
        class MockUploadFile:
            def __init__(self, filename, content):
                self.filename = filename
                self.file = MockFile(content)
            
            async def seek(self, position):
                self.file.seek(position)
        
        mock_upload_file = MockUploadFile(
            filename=metadata.get('filename', file_path.name),
            content=file_content
        )
        
        # Convert patient_id to UUID
        patient_id = uuid.UUID(metadata['patientId'])
        template_id = uuid.UUID(metadata['template'])
        
        print(f"Processing audio file: {file_path}")
        print(f"Metadata: {type(metadata)}")

        result = await orchestrator.create_transcription_job(
            file=mock_upload_file,
            patient_id=patient_id,
            current_provider=metadata['currentProvider'],
            visit_date=parse_datetime(metadata['visitDate']),
            note_type=metadata['noteType'],
            chief_complaint=metadata['chiefComplaint'],
            language=metadata.get('language', 'en-US'),
            template_id=template_id
        )
        
        print(f"Transcription job created successfully: {result}")
        
    except Exception as e:
        print(f"Error processing audio: {e}")
        # Handle error - maybe send notification or update database


# Cleanup task to remove expired sessions
async def cleanup_expired_sessions():
    """Periodically clean up expired upload sessions"""
    while True:
        await asyncio.sleep(300)  # Run every 5 minutes
        
        expired_sessions = []
        current_time = datetime.now()
        
        for session_id, session in upload_sessions.items():
            if current_time - session.created_at > SESSION_TIMEOUT:
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            session = upload_sessions[session_id]
            if session.temp_path.exists():
                os.remove(session.temp_path)
            del upload_sessions[session_id]


# Start cleanup task on app startup
@router.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_expired_sessions())


# Optional: Add resume capability
@router.post("/resume")
async def resume_upload(sessionId: str = Form(...)):
    """Resume an interrupted upload"""
    session = upload_sessions.get(sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Return which chunks are still needed
    missing_chunks = list(set(range(session.total_chunks)) - session.chunks_received)
    
    return JSONResponse({
        "sessionId": sessionId,
        "missingChunks": missing_chunks,
        "receivedChunks": list(session.chunks_received)
    })