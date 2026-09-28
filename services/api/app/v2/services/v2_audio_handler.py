import base64
import json
import os
import mimetypes
import threading
import asyncio
import time
import requests
from pathlib import Path
from typing import Dict, Any, Callable, List, Optional, Tuple, Union

import azure.cognitiveservices.speech as speechsdk
from fastapi import WebSocket
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AzureSpeechTranscriber:
    """
    A class to handle audio transcription using Azure Speech Services.
    Provides methods to transcribe audio files and handle common errors.
    """
    
    def __init__(self, speech_key: Optional[str] = None, speech_region: Optional[str] = None):
        """
        Initialize the transcriber with Azure Speech credentials.
        
        Args:
            speech_key: Azure Speech subscription key. If None, uses SPEECH_SUBSCRIPTION_KEY from env.
            speech_region: Azure Speech service region. If None, uses SPEECH_SERVICE_REGION from env.
        """
        self.speech_key = speech_key or os.getenv("SPEECH_SUBSCRIPTION_KEY")
        self.speech_region = speech_region or os.getenv("SPEECH_SERVICE_REGION")
        
        if not self.speech_key or not self.speech_region:
            raise ValueError("Azure Speech credentials are required. Set environment variables or pass them to the constructor.")
            
        # Configure logging
        self._setup_logging()
    
    def _setup_logging(self):
        """Set up logging configuration for the transcriber."""
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    
    def validate_audio_file(self, file_path: str) -> Dict[str, Any]:
        """
        Validate if a file is a valid audio file for transcription.
        
        Args:
            file_path: Path to the audio file to validate
            
        Returns:
            Dictionary with validation results
        """
        try:
            if not os.path.exists(file_path):
                return {"valid": False, "error": f"File not found: {file_path}"}
            
            # Check file size
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                return {"valid": False, "error": "File is empty"}
            
            # Check if file is too large (100MB limit for example)
            if file_size > 100 * 1024 * 1024:
                return {"valid": False, "error": "File is too large (>100MB)"}
            
            # Check file extension
            file_extension = os.path.splitext(file_path)[1].lower()
            supported_formats = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.mp4']
            
            if file_extension not in supported_formats:
                return {
                    "valid": False, 
                    "error": f"Unsupported file format: {file_extension}",
                    "supported_formats": supported_formats
                }
            
            # Check MIME type
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type or not mime_type.startswith('audio/'):
                return {"valid": False, "error": f"File doesn't appear to be audio: {mime_type}"}
            
            # Try to open the file to ensure it's readable
            try:
                with open(file_path, 'rb') as f:
                    # Read a small chunk to check if file is accessible
                    f.read(1024)
            except Exception as e:
                return {"valid": False, "error": f"Cannot read file: {str(e)}"}
            
            return {"valid": True}
            
        except Exception as e:
            return {"valid": False, "error": f"Validation error: {str(e)}"}
    
    async def transcribe_audio(self, file_path: str, language: str = "en-US", timeout: int = 600) -> Dict[str, Any]:
        """
        Transcribe audio file using Azure Speech Services.
        
        Args:
            file_path: Path to the audio file to transcribe
            language: Language code for transcription (e.g., "en-US")
            timeout: Maximum time in seconds for transcription
            
        Returns:
            Dictionary containing the transcription text and metadata
        """
        try:
            # Validate file exists
            if not os.path.exists(file_path):
                return {"error": f"File not found: {file_path}"}
                
            # Validate file is accessible
            try:
                with open(file_path, 'rb') as _:
                    pass
            except Exception as e:
                return {"error": f"Cannot access file: {str(e)}"}
                
            # Get the original filename from the path
            original_filename = os.path.basename(file_path)
            
            # Basic file format validation
            file_extension = os.path.splitext(file_path)[1].lower()
            supported_formats = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.mp4']
            if file_extension not in supported_formats:
                logger.warning(f"File extension {file_extension} may not be supported by Azure Speech Services")
            
            # Configure speech recognition
            speech_config = speechsdk.SpeechConfig(subscription=self.speech_key, region=self.speech_region)
            speech_config.speech_recognition_language = language
            
            # Set properties to handle potential audio format issues
            speech_config.set_property(speechsdk.PropertyId.SpeechServiceResponse_PostProcessingOption, "TrueText")
            
            # Configure audio input from file
            try:
                audio_config = speechsdk.audio.AudioConfig(filename=file_path)
            except Exception as e:
                return {"error": f"Failed to create audio config: {str(e)}"}
            
            # Create speech recognizer with proper error handling
            try:
                speech_recognizer = speechsdk.SpeechRecognizer(
                    speech_config=speech_config, 
                    audio_config=audio_config
                )
            except Exception as e:
                error_msg = str(e)
                if "SPXERR_INVALID_HEADER" in error_msg:
                    return {"error": "Invalid audio file format. The file header is not recognized by Azure Speech Services."}
                return {"error": f"Failed to create speech recognizer: {error_msg}"}
            
            # Store all transcription text
            all_results = []
            
            # Metadata to track
            audio_duration = 0
            word_count = 0
            
            # Create synchronization object
            done = asyncio.Event()
            
            # Callbacks for recognition events
            def recognized_cb(evt):
                if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
                    text = evt.result.text
                    all_results.append(text)
                    
                    # Update metadata
                    nonlocal audio_duration, word_count
                    audio_duration = max(audio_duration, (evt.result.offset + evt.result.duration) / 10000000)  # Convert to seconds
                    word_count += len(text.split())
                    
                    logger.debug(f"RECOGNIZED: {text}")
            
            def session_stopped_cb(evt):
                logger.info("Session stopped")
                done.set() 
            
            def canceled_cb(evt):
                logger.error(f"Recognition canceled: {evt.reason}")
                if evt.reason == speechsdk.CancellationReason.Error:
                    logger.error(f"Error details: {evt.error_details}")
                done.set()
                
            # Connect callbacks
            speech_recognizer.recognized.connect(recognized_cb)
            speech_recognizer.session_stopped.connect(session_stopped_cb)
            speech_recognizer.canceled.connect(canceled_cb)
            
            # Start continuous recognition
            speech_recognizer.start_continuous_recognition()
            
            # Wait for completion or timeout
            try:
                await asyncio.wait_for(done.wait(), timeout=timeout)
            except asyncio.TimeoutError:
                logger.warning(f"Transcription timeout after {timeout} seconds")
                speech_recognizer.stop_continuous_recognition()
                return {"error": f"Transcription timed out after {timeout} seconds"}
            
            # Stop recognition
            speech_recognizer.stop_continuous_recognition()
            
            # Combine all results into a single transcript
            full_transcript = " ".join(all_results)
            
            # Create the result payload
            result = {
                "transcription": full_transcript,
                "metadata": {
                    "filename": original_filename,
                    "language": language,
                    "duration_seconds": round(audio_duration, 2),
                    "word_count": word_count,
                    "transcription_time": time.time()
                }
            }
            
            return result
            
        except Exception as e:
            error_message = str(e)
            logger.error(f"Error in transcription process: {error_message}")
            
            # Handle specific known errors
            if "SPXERR_INVALID_HEADER" in error_message:
                return {
                    "error": "Invalid audio file format. The file header is not recognized by Azure Speech Services.",
                    "details": error_message,
                    "suggestions": [
                        "Ensure the file is a valid audio file",
                        "Try converting to WAV format using a tool like FFmpeg",
                        "Check if the file is corrupted"
                    ]
                }
            
            return {"error": error_message}
    
    def transcribe_audio_sync(self, file_path: str, language: str = "en-US", timeout: int = 600) -> Dict[str, Any]:
        """
        Synchronous wrapper for the async transcribe_audio method.
        
        Args:
            file_path: Path to the audio file to transcribe
            language: Language code for transcription (e.g., "en-US")
            timeout: Maximum time in seconds for transcription
            
        Returns:
            Dictionary containing the transcription text and metadata
        """
        try:
            return asyncio.run(self.transcribe_audio(file_path, language, timeout))
        except KeyboardInterrupt:
            logger.warning("Transcription interrupted by user.")
            return {"error": "Transcription interrupted by user."}
        except Exception as e:
            logger.error(f"Error during synchronous transcription: {str(e)}")
            return {"error": f"Error during synchronous transcription: {str(e)}"}
    
    async def transcribe_from_url(self, audio_url: str, language: str = "en-US", timeout: int = 600) -> Dict[str, Any]:
        """
        Download and transcribe audio from a URL.
        
        Args:
            audio_url: URL of the audio file to download and transcribe
            language: Language code for transcription
            timeout: Maximum time for transcription
            
        Returns:
            Dictionary containing the transcription text and metadata
        """
        temp_dir = os.path.join(os.getcwd(), "temp_audio")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Extract filename from URL if possible
        try:
            filename = os.path.basename(audio_url.split('?')[0])
            if not filename:
                filename = f"audio_{int(time.time())}.wav"
        except:
            filename = f"audio_{int(time.time())}.wav"
        
        temp_file_path = os.path.join(temp_dir, filename)
        
        try:
            # Download the file
            logger.info(f"Downloading audio from {audio_url}")
            response = requests.get(audio_url, stream=True)
            response.raise_for_status()
            
            with open(temp_file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"Downloaded audio file to {temp_file_path}")
            
            # Transcribe the downloaded file
            result = await self.transcribe_audio(temp_file_path, language, timeout)
            return result
            
        except Exception as e:
            error_message = str(e)
            logger.error(f"Error in URL transcription process: {error_message}")
            return {"error": f"Failed to transcribe from URL: {error_message}"}
            
        finally:
            # Clean up the temporary file
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                    logger.info(f"Removed temporary file {temp_file_path}")
            except Exception as e:
                logger.error(f"Error removing temporary file: {str(e)}")
    
    def transcribe_and_save_json(self, file_path: str, output_path: Optional[str] = None, 
                                language: str = "en-US", timeout: int = 600) -> Dict[str, Any]:
        """
        Transcribe audio and save the result as a JSON file.
        
        Args:
            file_path: Path to the audio file to transcribe
            output_path: Path where to save the JSON output. If None, saves with same name as audio but .json extension
            language: Language code for transcription (e.g., "en-US")
            timeout: Maximum time in seconds for transcription
            
        Returns:
            Dictionary containing the transcription text and metadata
        """
        # Get transcription result
        result = self.transcribe_audio_sync(file_path, language, timeout)
        
        # Determine output path if not provided
        if output_path is None:
            base_path = os.path.splitext(file_path)[0]
            output_path = f"{base_path}.json"
        
        # Save as JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Transcription saved to {output_path}")
        
        return result


class RealtimeTranscriptionManager:
    """
    Manager for real-time transcription sessions using Azure Speech Services.
    This class allows for WebSocket-based real-time audio transcription.
    
    It manages multiple transcription sessions and provides methods to create,
    retrieve, and close sessions, as well as process audio data in real-time.
    """
    
    def __init__(self, speech_key: Optional[str] = None, speech_region: Optional[str] = None):
        """
        Initialize the real-time transcription manager.
        
        Args:
            speech_key: Azure Speech subscription key. If None, uses SPEECH_SUBSCRIPTION_KEY from env.
            speech_region: Azure Speech service region. If None, uses SPEECH_SERVICE_REGION from env.
        """
        self.speech_key = speech_key or os.getenv("SPEECH_SUBSCRIPTION_KEY")
        self.speech_region = speech_region or os.getenv("SPEECH_SERVICE_REGION")
        self.sessions = {}
        
        if not self.speech_key or not self.speech_region:
            raise ValueError("Azure Speech credentials are required. Set environment variables or pass them to the constructor.")
            
        logger.info("Initialized RealtimeTranscriptionManager")
    
    async def create_session(self, websocket: WebSocket, session_id: str, language: str = "en-US") -> Dict[str, Any]:
        """
        Create a new real-time transcription session.
        
        Args:
            websocket: The WebSocket connection for this session
            session_id: Unique ID for the session
            language: Language code for transcription
            
        Returns:
            Dictionary with session information
        """
        try:
            # Create a new session
            session = TranscriptionSession(
                websocket=websocket,
                session_id=session_id,
                speech_key=self.speech_key,
                speech_region=self.speech_region,
                language=language
            )
            
            # Initialize the session
            await session.initialize()
            
            # Store the session
            self.sessions[session_id] = session
            
            logger.info(f"Created transcription session {session_id}")
            
            return {
                "session_id": session_id,
                "status": "initialized",
                "language": language
            }
            
        except Exception as e:
            logger.error(f"Error creating transcription session: {str(e)}")
            return {"error": f"Failed to create transcription session: {str(e)}"}
    
    def get_session(self, session_id: str) -> Optional['TranscriptionSession']:
        """
        Get an existing transcription session by ID.
        
        Args:
            session_id: The ID of the session to retrieve
            
        Returns:
            The TranscriptionSession if found, None otherwise
        """
        return self.sessions.get(session_id)
    
    async def close_session(self, session_id: str) -> Dict[str, Any]:
        """
        Close a transcription session and return the complete transcription.
        
        Args:
            session_id: The ID of the session to close
            
        Returns:
            Dictionary with the complete transcription and metadata
        """
        session = self.sessions.get(session_id)
        if not session:
            return {"error": f"Session {session_id} not found"}
        
        try:
            # Get the complete transcription
            complete_transcription = session.get_complete_transcription()
            
            # Get metadata
            metadata = session.get_metadata()
            
            # Close the session
            await session.close()
            
            # Remove from sessions dict
            del self.sessions[session_id]
            
            logger.info(f"Closed transcription session {session_id}")
            
            return {
                "session_id": session_id,
                "status": "closed",
                "transcription": complete_transcription,
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Error closing transcription session: {str(e)}")
            return {"error": f"Failed to close transcription session: {str(e)}"}
    
    def get_active_sessions_count(self) -> int:
        """
        Get the number of active transcription sessions.
        
        Returns:
            The number of active sessions
        """
        return len(self.sessions)


class TranscriptionSession:
    """
    Manages a single real-time transcription session using Azure Speech Services.
    
    This class handles the WebSocket connection, audio processing, and transcription
    for a single user session. It maintains the state of the transcription and
    provides methods to process audio data and retrieve results.
    """
    
    def __init__(
        self, 
        websocket: WebSocket, 
        session_id: str, 
        speech_key: str, 
        speech_region: str,
        language: str = "en-US"
    ):
        """
        Initialize a transcription session.
        
        Args:
            websocket: The WebSocket connection for this session
            session_id: Unique ID for the session
            speech_key: Azure Speech subscription key
            speech_region: Azure Speech service region
            language: Language code for transcription
        """
        self.websocket = websocket
        self.session_id = session_id
        self.speech_key = speech_key
        self.speech_region = speech_region
        self.language = language
        
        self.speech_recognizer = None
        self.audio_stream = None
        self.active = True
        
        self.all_transcriptions = []
        self.is_final = False
        self.current_text = ""
        self.start_time = time.time()
        self.audio_duration = 0
        self.word_count = 0
    
    async def initialize(self):
        """Initialize Azure Speech recognition resources for this session."""
        # Configure speech recognition
        speech_config = speechsdk.SpeechConfig(
            subscription=self.speech_key, 
            region=self.speech_region
        )
        speech_config.speech_recognition_language = self.language
        
        # Create an audio stream
        self.audio_stream = speechsdk.audio.PushAudioInputStream()
        audio_config = speechsdk.audio.AudioConfig(stream=self.audio_stream)
        
        # Create speech recognizer
        self.speech_recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config, 
            audio_config=audio_config
        )
        
        # Set up callbacks
        self.speech_recognizer.recognized.connect(self._recognized_cb)
        self.speech_recognizer.recognizing.connect(self._recognizing_cb)
        self.speech_recognizer.session_stopped.connect(self._session_stopped_cb)
        self.speech_recognizer.canceled.connect(self._canceled_cb)
        
        # Start continuous recognition
        self.speech_recognizer.start_continuous_recognition()
        logger.info(f"Session {self.session_id}: Initialized speech recognition")
    
    def _recognized_cb(self, evt):
        """Callback for final recognition results."""
        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            text = evt.result.text
            self.current_text = text
            self.is_final = True
            
            # Update metadata
            self.audio_duration = max(self.audio_duration, 
                                    (evt.result.offset + evt.result.duration) / 10000000)
            self.word_count += len(text.split())
            
            # Store final transcriptions
            if text.strip():
                self.all_transcriptions.append(text)
            
            logger.info(f"Session {self.session_id}: RECOGNIZED: {text}")
    
    def _recognizing_cb(self, evt):
        """Callback for interim recognition results."""
        if evt.result.reason == speechsdk.ResultReason.RecognizingSpeech:
            text = evt.result.text
            self.current_text = text
            self.is_final = False
            
            logger.debug(f"Session {self.session_id}: RECOGNIZING: {text}")
    
    def _session_stopped_cb(self, evt):
        """Callback for session stopped events."""
        logger.info(f"Session {self.session_id}: Session stopped")
    
    def _canceled_cb(self, evt):
        """Callback for canceled events."""
        logger.error(f"Session {self.session_id}: Recognition canceled: {evt.reason}")
        if evt.reason == speechsdk.CancellationReason.Error:
            logger.error(f"Session {self.session_id}: Error details: {evt.error_details}")
    
    async def process_audio(self, audio_base64: str) -> Dict[str, Any]:
        """
        Process a chunk of base64-encoded audio data.
        
        Args:
            audio_base64: Base64-encoded audio data
            
        Returns:
            Dictionary with recognition results if available
        """
        if not self.active or not self.audio_stream:
            return {"error": "Session is not active"}
        
        try:
            # Decode base64 audio
            audio_data = base64.b64decode(audio_base64)
            
            # Write to the audio stream
            self.audio_stream.write(audio_data)
            
            # Return result if available
            if self.current_text:
                result = {
                    "text": self.current_text,
                    "is_final": self.is_final,
                    "session_id": self.session_id
                }
                
                # Reset current text if it was final
                if self.is_final:
                    self.current_text = ""
                    self.is_final = False
                
                return result
            
            return {"status": "processing", "session_id": self.session_id}
            
        except Exception as e:
            logger.error(f"Session {self.session_id}: Error processing audio: {str(e)}")
            return {"error": f"Error processing audio: {str(e)}"}
    
    def get_complete_transcription(self) -> str:
        """
        Get the complete transcription from all final results.
        
        Returns:
            Complete transcription text
        """
        return " ".join(self.all_transcriptions)
    
    def get_metadata(self) -> Dict[str, Any]:
        """
        Get metadata about the transcription session.
        
        Returns:
            Dictionary with session metadata
        """
        return {
            "session_id": self.session_id,
            "language": self.language,
            "duration_seconds": round(self.audio_duration, 2),
            "word_count": self.word_count,
            "session_time": round(time.time() - self.start_time, 2),
            "segments_count": len(self.all_transcriptions)
        }
    
    async def close(self):
        """Clean up resources when the session ends."""
        self.active = False
        
        if self.speech_recognizer:
            try:
                # Create a synchronization object
                stop_future = threading.Event()
                
                def stopped_cb(evt):
                    stop_future.set()
                
                # Connect to the session_stopped event
                self.speech_recognizer.session_stopped.connect(stopped_cb)
                
                # Stop continuous recognition
                self.speech_recognizer.stop_continuous_recognition_async()
                
                # Wait for stop to complete (with timeout)
                stop_future.wait(timeout=5)
                
                self.speech_recognizer = None
                logger.info(f"Session {self.session_id}: Speech recognizer stopped")
                
            except Exception as e:
                logger.error(f"Session {self.session_id}: Error stopping speech recognizer: {str(e)}")
                self.speech_recognizer = None
        
        if self.audio_stream:
            try:
                self.audio_stream.close()
                self.audio_stream = None
                logger.info(f"Session {self.session_id}: Audio stream closed")
            except Exception as e:
                logger.error(f"Session {self.session_id}: Error closing audio stream: {str(e)}")
                self.audio_stream = None
                
        logger.info(f"Session {self.session_id}: Closed")


if __name__ == "__main__":
    # Example usage for file transcription
    try:
        audio_file = "example.wav"
        language = "en-US"
        
        # Create transcriber instance
        transcriber = AzureSpeechTranscriber()
        
        # First validate the audio file
        validation_result = transcriber.validate_audio_file(audio_file)
        
        if validation_result["valid"]:
            print(f"File {audio_file} is valid. Proceeding with transcription...")
            
            # Transcribe and save as JSON in one step
            result = transcriber.transcribe_and_save_json(audio_file, language=language, output_path="output.json")
            print(json.dumps(result, indent=2))
            
        else:
            print(f"File validation failed: {validation_result['error']}")
    
    except Exception as e:
        print(f"Error: {str(e)}")