import os
import uuid
import logging
import asyncio
import time
import json
import shutil
import subprocess
from typing import Dict, Any, Optional, List, Tuple, Union
from datetime import datetime
import requests
from fastapi import HTTPException, UploadFile
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager

# Import our service classes
from app.v2.services.v2_blob_handler import BlobStorageHandler
from app.v2.services.v2_audio_deepgram_with_check import DeepgramTranscriber
from app.v2.services.v2_analytics_handler import MedicalTextAnalyzer
from app.v2.services.v2_generate_note import NoteGenerator
from app.v2.services.evaluator import evaluate_note

# Import database models and utilities
from app.v2.models.note import (
    MedicalNoteCRUD,
    MedicalNoteCreate,
    MedicalNoteUpdate,
    MedicalNoteResponse,
    NoteStatus,
    NoteType
)
from app.v2.models.patient import PatientCRUD
from app.v2.models.provider import ProviderModel
from app.v2.models.sections import (
    NoteSectionCreate,
    SectionType,
    NoteSectionResponse,
    NoteSectionUpdate,
    NoteSectionModel,
    NoteSectionCRUD
)
from app.database import get_db

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MedicalTranscriptionOrchestrator:
    """
    Orchestrates the end-to-end process of medical transcription, analysis, and note generation.
    """
    
    # Keep track of background tasks to prevent garbage collection
    _background_tasks = set()
    
    def __init__(self):
        """Initialize the orchestrator with service instances."""
        # Initialize service components
        self.blob_handler = BlobStorageHandler()
        self.transcriber = DeepgramTranscriber()
        self.analyzer = MedicalTextAnalyzer()
        self.note_generator = NoteGenerator()
        
        # Set configuration from environment variables
        self.max_retries = int(os.getenv("MAX_RETRIES", "0"))
        self.retry_delay = int(os.getenv("RETRY_DELAY", "5"))  # seconds
        
        # Ensure temp directories exist
        self.temp_dir = "temp_audio"
        self.converted_dir = "converted_audio"
        os.makedirs(self.temp_dir, exist_ok=True)
        os.makedirs(self.converted_dir, exist_ok=True)
        
        logger.info("Initialized MedicalTranscriptionOrchestrator")
    
    async def create_transcription_job(
        self,
        file: UploadFile,
        patient_id: uuid.UUID,
        current_provider: ProviderModel,
        visit_date: datetime,
        note_type: str,
        chief_complaint: str,
        language: str = "en-US",
        template_id: Optional[uuid.UUID] = None,
        template_name: Optional[str] = None,
        transcript: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new medical note and start the transcription job.
        """
        # Generate a unique job ID
        job_id = uuid.uuid4()
        
        # Create database session
        db = next(get_db())
        
        try:
            # Create CRUD instance
            note_crud = MedicalNoteCRUD(db)
            patient_crud = PatientCRUD(db)

            patientModel = patient_crud.get_patient(patient_id=patient_id, current_provider=current_provider)
            
            # Create note record in database with PROCESSING status

            note_title = f"{patientModel.full_name} : {chief_complaint.capitalize()} , {note_type}"
            note_data = MedicalNoteCreate(
                job_id=job_id,
                patient_id=patient_id,
                provider_id=current_provider.iUserId,
                visit_date=visit_date,
                note_title=note_title,
                note_type=note_type,
                chief_complaint=chief_complaint,
                status=NoteStatus.PROCESSING
            )
            
            # Create note using CRUD operation
            db_note = note_crud.create_note(note_data)
            note_id = str(db_note.note_id)
            logger.info(f"Created note record with ID: {note_id}")
            
            # Save the uploaded file to a temporary location first
            # This is crucial to prevent the "seek of closed file" error
            logger.info(f"filename : {file.filename}")
            temp_file_path = os.path.join(self.temp_dir, f"upload_{note_id}{os.path.splitext(file.filename)[1]}")
            
            try:
                # Save the file
                with open(temp_file_path, "wb") as temp_file:
                    # Reset to beginning of file
                    await file.seek(0)
                    # Copy content
                    shutil.copyfileobj(file.file, temp_file)
                
                logger.info(f"Saved uploaded file to temporary location: {temp_file_path}")
                
                # Now start background task with the saved file path
                task = asyncio.create_task(
                    self._process_job(
                        file_path=temp_file_path,
                        file_name=file.filename,
                        note_id=note_id,
                        current_provider=current_provider,
                        note_type=note_type,
                        template_id=template_id,
                        patient_id=patient_id,
                        template_name=template_name,
                        transcript=transcript,
                        language=language,
                    )
                )
                
                # Add task to set to prevent garbage collection
                self._background_tasks.add(task)
                task.add_done_callback(self._background_tasks.discard)
                
                # Return response with job information
                return {
                    "status": "processing",
                    "message": "Transcription job created successfully",
                    "note_id": note_id,
                    "job_id": str(job_id)
                }
                
            except Exception as e:
                # If we failed to save the file, update the note status
                error_msg = f"Failed to save uploaded file: {str(e)}"
                logger.error(error_msg)
                
                note_update = MedicalNoteUpdate(
                    status=NoteStatus.ERROR,
                    note_json=json.dumps({"error": error_msg})
                )
                note_crud.update_note(uuid.UUID(note_id), note_update, current_provider)
                
                raise HTTPException(status_code=500, detail=error_msg)
            
        except Exception as e:
            logger.error(f"Error creating transcription job: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to create transcription job: {str(e)}")
        finally:
            db.close()
    
    async def convert_to_wav(self, input_file: str, note_id: str) -> str:
        """
        Convert any audio file to WAV format using ffmpeg.
        
        Args:
            input_file: Path to the input audio file
            note_id: Note ID for naming the output file
            
        Returns:
            Path to the converted WAV file
        """
        # Make sure output directories exist
        os.makedirs(self.converted_dir, exist_ok=True)
        
        # Use absolute paths everywhere
        input_file_abs = os.path.abspath(input_file)
        output_file = os.path.join(self.converted_dir, f"{note_id}_converted.wav")
        output_file_abs = os.path.abspath(output_file)
        
        logger.info(f"Input file (absolute): {input_file_abs}")
        logger.info(f"Output file (absolute): {output_file_abs}")
        logger.info(f"Current directory: {os.getcwd()}")
        
        try:
            # Ensure the input file exists
            if not os.path.exists(input_file_abs):
                raise FileNotFoundError(f"Input file not found: {input_file_abs}")
                
            logger.info(f"Converting audio file {input_file_abs} to WAV format...")
            
            # Run the conversion in a separate thread to avoid blocking
            def run_conversion():
                try:
                    # Find ffmpeg executable
                    ffmpeg_path = shutil.which("ffmpeg")
                    if ffmpeg_path:
                        logger.info(f"Found ffmpeg at: {ffmpeg_path}")
                    else:
                        logger.warning("ffmpeg not found in PATH!")
                        # Fall back to common locations
                        possible_locations = [
                            "/usr/bin/ffmpeg",
                            "/usr/local/bin/ffmpeg",
                            "/opt/ffmpeg/bin/ffmpeg"
                        ]
                        for loc in possible_locations:
                            if os.path.exists(loc):
                                ffmpeg_path = loc
                                logger.info(f"Found ffmpeg at alternative location: {ffmpeg_path}")
                                break
                    
                    if not ffmpeg_path and not shutil.which("ffmpeg"):
                        raise FileNotFoundError("FFmpeg executable not found. Make sure it's installed and in PATH.")

                    cmd = [
                        ffmpeg_path or "ffmpeg",  # Use discovered path or default to "ffmpeg"
                        "-i", input_file_abs,     # Input file (absolute path)
                        "-ar", "16000",           # Sample rate of 16kHz
                        "-ac", "1",               # 1 audio channel (mono)
                        "-c:a", "pcm_s16le",      # PCM 16-bit encoding
                        "-y",                     # Overwrite output file if it exists
                        output_file_abs           # Output file (absolute path)
                    ]
                    
                    logger.info(f"Running command: {' '.join(cmd)}")
                    
                    # Run the command
                    result = subprocess.run(
                        cmd, 
                        stdout=subprocess.PIPE, 
                        stderr=subprocess.PIPE,
                        check=True
                    )
                    
                    if os.path.exists(output_file_abs) and os.path.getsize(output_file_abs) > 0:
                        return True, output_file
                    else:
                        return False, f"Conversion failed: Output file is empty or doesn't exist"
                    
                except subprocess.CalledProcessError as e:
                    error_output = e.stderr.decode() if e.stderr else str(e)
                    logger.error(f"FFmpeg process error: {error_output}")
                    return False, f"FFmpeg error: {error_output}"
                except Exception as e:
                    logger.error(f"Conversion error: {str(e)}")
                    return False, f"Conversion error: {str(e)}"
            
            # Run the conversion in a thread pool
            loop = asyncio.get_running_loop()
            success, result = await loop.run_in_executor(None, run_conversion)
            
            if success:
                logger.info(f"Successfully converted audio to WAV: {output_file}")
                return output_file
            else:
                logger.error(result)
                raise Exception(result)
                
        except Exception as e:
            logger.error(f"Error converting audio file: {str(e)}")
            raise Exception(f"Audio conversion failed: {str(e)}")
    
    async def _process_job(
        self,
        note_id: str,
        file_path: str,
        file_name: str,
        patient_id: uuid.UUID,
        current_provider: ProviderModel,
        note_type: str,
        template_id: Optional[uuid.UUID] = None,
        template_name: Optional[str] = None,
        transcript: Optional[str] = None,
        language: str = "en-US",
    ):
        """
        Process a transcription job in the background with retry logic.
        
        This version uses a saved file path instead of the UploadFile object
        to avoid the "seek of closed file" error, and converts the audio to WAV format.
        """
        # Track retry attempt
        retry_count = 0
        local_file_path = file_path  # Original uploaded file
        converted_file_path = None   # Will store the WAV file path
        mock_file = None

        try:
            while True:
                # Create CRUD instance
                db = next(get_db())
                note_crud = MedicalNoteCRUD(db)
                section_crud = NoteSectionCRUD(db)

                try:
                    # Step 1: Convert audio to WAV format
                    local_file_path = await self._convert_audio_to_wav(
                        local_file_path, converted_file_path, note_id, note_crud, current_provider
                    )
                    converted_file_path = local_file_path
                     
                    # Step 2: Upload file to blob storage
                    blob_info = await self._upload_to_blob_storage(
                        local_file_path, file_name, note_id, patient_id, current_provider, note_crud
                    )
                    
                    # Step 3: Transcribe the audio file
                    transcription_result, transcript_text = await self._transcribe_audio(
                        local_file_path, note_id, language, note_crud, current_provider
                    )
                    
                    # Step 4: Generate medical note
                    note_result = await self._generate_medical_note(
                        note_id, note_type, template_id, transcript_text, current_provider, db
                    )
                    
                    # Step 5: Save note sections
                    await self._save_note_sections(note_result, note_id, section_crud)
                    
                    # Step 6: Evaluate the generated note
                    await self._evaluate_note(
                        note_result, transcription_result, note_id, note_crud, current_provider
                    )
                    
                    # Success - exit the retry loop
                    break
                    
                except Exception as e:
                    if(str(e).lower() == "failed"):
                        logger.error(f"Transcription failed for note {note_id}, No medical relevant discussion found")
                        break
                    retry_count = await self._handle_processing_error(
                        e, retry_count, note_id, note_crud, current_provider
                    )
                    if retry_count > self.max_retries:
                        break

                finally:
                    # Close database session
                    db.close()

        finally:
            # Clean up resources
            await self._cleanup_resources(mock_file, file_path, converted_file_path)

    async def _convert_audio_to_wav(
        self, 
        local_file_path: str, 
        converted_file_path: Optional[str], 
        note_id: str, 
        note_crud: MedicalNoteCRUD, 
        current_provider: ProviderModel
    ) -> str:
        """Convert audio file to WAV format."""
        if not converted_file_path:
            logger.info(f"Converting audio file for note {note_id} to WAV format")
            
            # Update note status
            note_update = MedicalNoteUpdate(status=NoteStatus.PROCESSING)
            note_crud.update_note(uuid.UUID(note_id), note_update, current_provider)
            
            try:
                # Convert the file
                converted_file_path = await self.convert_to_wav(local_file_path, note_id)
                logger.info(f"Audio file converted successfully to {converted_file_path}")
                return converted_file_path
            except Exception as e:
                error_msg = f"Failed to convert audio file: {str(e)}"
                logger.error(error_msg)
                raise Exception(error_msg)
        
        return local_file_path

    async def _upload_to_blob_storage(
        self, 
        local_file_path: str, 
        file_name: str, 
        note_id: str, 
        patient_id: uuid.UUID, 
        current_provider: ProviderModel, 
        note_crud: MedicalNoteCRUD
    ) -> Dict[str, Any]:
        """Upload file to blob storage."""
        logger.info(f"Uploading converted WAV file for note {note_id}")
        
        # Create mock upload file for the converted WAV
        mock_file = self._create_mock_upload_file(local_file_path, file_name)
        
        try:
            # Upload to blob storage using the mock file
            blob_info = self.blob_handler.upload_file(
                file=mock_file,
                provider_id=current_provider.iUserId,
                patient_id=patient_id
            )
            
            # Update note with blob information
            note_update = MedicalNoteUpdate(
                blob_filepath=blob_info.get("blob_name"),
                status=NoteStatus.PROCESSING
            )
            note_crud.update_note(uuid.UUID(note_id), note_update, current_provider)
            logger.info(f"Updated note {note_id} with blob path: {blob_info.get('blob_name')}")
            
            return blob_info
        finally:
            mock_file.close()

    def _create_mock_upload_file(self, file_path: str, filename: str):
        """Create a mock UploadFile object for blob storage."""
        class MockUploadFile:
            def __init__(self, file_path, filename, content_type):
                self.file = open(file_path, "rb")
                self.filename = filename
                self.content_type = content_type
                self.size = os.path.getsize(file_path)
            
            def close(self):
                if not self.file.closed:
                    self.file.close()
        
        return MockUploadFile(
            file_path, 
            f"{os.path.splitext(filename)[0]}.wav", 
            "audio/wav"
        )

    async def _transcribe_audio(
        self, 
        local_file_path: str, 
        note_id: str, 
        language: str, 
        note_crud: MedicalNoteCRUD, 
        current_provider: ProviderModel
    ) -> Tuple[Dict[str, Any], str]:
        """Transcribe the audio file and validate medical content."""
        logger.info(f"Transcribing WAV audio for note {note_id}")
        
        # Make sure file exists
        if not os.path.exists(local_file_path):
            raise Exception(f"Converted WAV file not found at {local_file_path}")
        
        # Transcribe audio
        transcription_result = self.transcriber.transcribe_audio(
            file_path=local_file_path,
            language=language
        )
        
        # Check for transcription error
        if "error" in transcription_result:
            raise Exception(f"Transcription failed: {transcription_result['error']}")
    
        # Extract transcription text and metadata
        metadata = transcription_result.get("metadata", {})
        transcription_data = transcription_result.get("transcription", "")
        if isinstance(transcription_data, list):
            # If it's a list of objects, join all text fields
            transcript_text = " ".join(item.get("text", "") for item in transcription_data)
        else:
            # If it's already a string, use it as is
            transcript_text = transcription_data
        
        # Store transcription result, metadata in note_json field
        transcription_data = {
            "transcription": transcript_text,
            "metadata": metadata,
            "transcription_data": transcription_data
        }
        
        all_text = " ".join([utt["text"] for utt in transcription_result["transcription"] if utt["text"]])
        if not self.transcriber.contains_medical_terms_optimized(all_text):
            logger.warning(f"No medical discussion found in transcription for note {note_id}")
            # Update the note model fields
            note_update = MedicalNoteUpdate(
                transcription_result=transcription_data,
                status=NoteStatus.FAILED
            )
            note_crud.update_note(uuid.UUID(note_id), note_update, current_provider)
            logger.info(f"Updated note {note_id} with transcription data")
            raise Exception("failed")
    
        # Update the note model fields
        note_update = MedicalNoteUpdate(
            transcription_result=transcription_data,
            status=NoteStatus.ANALYZING
        )
        note_crud.update_note(uuid.UUID(note_id), note_update, current_provider)
        logger.info(f"Updated note {note_id} with transcription data")
        
        return transcription_result, transcript_text

    async def _generate_medical_note(
        self, 
        note_id: str, 
        note_type: str, 
        template_id: Optional[uuid.UUID], 
        transcript_text: str, 
        current_provider: ProviderModel, 
        db: Session
    ) -> Dict[str, Any]:
        """Generate medical note using appropriate template."""
        logger.info(f"Generating {note_type} for note {note_id}")

        # Initialize note generator with db session
        note_generator = NoteGenerator(db=db)

        # Determine if this is a custom template scenario
        if template_id:
            logger.info(f"Using custom template with ID: {template_id}")
            # Generate note using custom template
            note_result = note_generator.generate_note(
                analytics_data={},
                transcription=transcript_text,
                note_type=note_type,  # Pass "CUSTOM" as note type
                provider_id=current_provider.iUserId,
                template_id=template_id  # Pass the template ID
            )
        else:
            logger.info(f"Using predefined note type: {note_type}")
            # Generate note using predefined note type
            note_result = note_generator.generate_note(
                analytics_data={},
                transcription=transcript_text,
                note_type=note_type,  # Pass the actual note type (SOAP, PROGRESS, etc.)
                provider_id=current_provider.iUserId,
                template_id=None  # No template ID for predefined types
            )

        # Check for note generation error
        if "error" in note_result:
            raise Exception(f"Note generation failed: {note_result['error']}")

        return note_result

    async def _save_note_sections(
        self, 
        note_result: Dict[str, Any], 
        note_id: str, 
        section_crud: NoteSectionCRUD
    ) -> None:
        """Save note sections to the database."""
        if "sections" in note_result:
            # Sort sections by their preference
            sorted_sections = sorted(note_result["sections"], key=lambda x: x.get("section_preference", 99))
            
            # Save each section to the database
            for index, section in enumerate(sorted_sections):
                section_name = section.get("section_name", "")
                section_content = section.get("content", "")
                section_type = section.get("section_type", "")
                
                # Create the section in the database
                try:
                    section_data = NoteSectionCreate(
                        note_id=uuid.UUID(note_id),
                        section_type=section_type, 
                        content=section_content,
                        section_name=section_name,
                        sequence_number=index
                    )
                    section_crud.create_section(section_data)
                    logger.info(f"Created note section: {section_name} for note {note_id}")
                except Exception as e:
                    logger.error(f"Error creating note section: {str(e)}")
            
            # Log the template used (for debugging/auditing)
            if "template_used" in note_result:
                template_info = note_result["template_used"]
                if template_info["type"] == "custom":
                    logger.info(f"Note generated using custom template: {template_info['template_name']} (ID: {template_info['template_id']})")
                else:
                    logger.info(f"Note generated using predefined template: {template_info['note_type']}")
        else:
            logger.warning("Note content could not be generated - no sections returned")

    async def _evaluate_note(
        self, 
        note_result: Dict[str, Any], 
        transcription_result: Dict[str, Any], 
        note_id: str, 
        note_crud: MedicalNoteCRUD, 
        current_provider: ProviderModel
    ) -> None:
        """Evaluate the generated note and update status."""
        logger.info(f"Evaluating generated note for note {note_id}")
        
        # Get the generated note content
        note_content = [section.get("content") for section in note_result.get("sections", [])]
        note_string = "\n".join(note_content)

        transcript_contents = [phrases.get("text") for phrases in transcription_result.get("transcription", [])]
        transcript_string = "\n".join(transcript_contents)

        evaluation_result = evaluate_note(note_string, transcript_string)
        result = evaluation_result.get('routing_decision')

        logger.info(f"Evaluation result for note {note_id}: {evaluation_result}")

        # Determine status based on evaluation result
        status = self._determine_note_status(result, note_id)

        # Update the note with evaluation results
        note_update = MedicalNoteUpdate(
            evaluation_result=evaluation_result,
            status=status
        )
        note_crud.update_note(uuid.UUID(note_id), note_update, current_provider)
        logger.info(f"Note {note_id} evaluated successfully with status {status}")

    def _determine_note_status(self, result: str, note_id: str) -> NoteStatus:
        """Determine note status based on evaluation result."""
        match result.lower():
            case 'approve':
                logger.info(f"Note {note_id} approved based on evaluation")
                return NoteStatus.COMPLETED
            case 'review':
                logger.info(f"Note {note_id} requires review based on evaluation")
                return NoteStatus.REVIEWING
            case 'redictation':
                logger.info(f"Note {note_id} requires re-dictation based on evaluation")
                return NoteStatus.QUALITY_CHECK
            case _:
                logger.error(f"Unknown routing decision: {result}")
                return NoteStatus.REVIEWING

    async def _handle_processing_error(
        self, 
        error: Exception, 
        retry_count: int, 
        note_id: str, 
        note_crud: MedicalNoteCRUD, 
        current_provider: ProviderModel
    ) -> int:
        """Handle processing errors with retry logic."""
        logger.error(f"Error processing note {note_id}: {str(error)}")
        
        # Increment retry counter
        retry_count += 1
        
        if retry_count <= self.max_retries:
            # Log retry attempt
            logger.info(f"Retrying note {note_id} (attempt {retry_count} of {self.max_retries})")
            
            # Update note status for retry
            try:
                note_update = MedicalNoteUpdate(status=NoteStatus.PROCESSING)
                note_crud.update_note(uuid.UUID(note_id), note_update, current_provider)
            except Exception as e2:
                logger.error(f"Error updating note status for retry: {str(e2)}")
            
            # Wait before retry
            await asyncio.sleep(self.retry_delay)
        else:
            # Max retries reached, mark as failed - use ERROR status
            try:
                note_update = MedicalNoteUpdate(status=NoteStatus.ERROR)
                note_crud.update_note(uuid.UUID(note_id), note_update, current_provider)
                logger.error(f"Note {note_id} failed after {self.max_retries} retries")
            except Exception as e2:
                logger.error(f"Error updating note status to failed: {str(e2)}")
        
        return retry_count

    async def _cleanup_resources(
        self, 
        mock_file: Optional[Any], 
        file_path: str, 
        converted_file_path: Optional[str]
    ) -> None:
        """Clean up temporary files and resources."""
        # Clean up resources
        if mock_file:
            mock_file.close()
        
        # Clean up temporary files
        try:
            # Remove the original uploaded file
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Removed original uploaded file {file_path}")
            
            # Remove the converted WAV file
            if converted_file_path and os.path.exists(converted_file_path):
                os.remove(converted_file_path)
                logger.info(f"Removed converted WAV file {converted_file_path}")
        except Exception as e:
            logger.error(f"Error removing temporary files: {str(e)}")
                