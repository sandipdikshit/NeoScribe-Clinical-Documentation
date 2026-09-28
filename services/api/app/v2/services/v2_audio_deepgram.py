import os
import json
import time
import logging
import requests
import mimetypes
from typing import Dict, Any, Optional, List
from deepgram import DeepgramClient
from dotenv import load_dotenv
from datetime import datetime, timezone

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DeepgramTranscriber:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError("Deepgram API key is required.")
        self.dg_client = DeepgramClient(self.api_key)

    def validate_audio_file(self, file_path: str) -> Dict[str, Any]:
        try:
            if not os.path.exists(file_path):
                return {"valid": False, "error": f"File not found: {file_path}"}

            file_size = os.path.getsize(file_path)
            if file_size == 0:
                return {"valid": False, "error": "File is empty"}
            if file_size > 100 * 1024 * 1024:
                return {"valid": False, "error": "File is too large (>100MB)"}

            file_extension = os.path.splitext(file_path)[1].lower()
            supported_formats = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.mp4']
            if file_extension not in supported_formats:
                return {
                    "valid": False,
                    "error": f"Unsupported file format: {file_extension}",
                    "supported_formats": supported_formats
                }

            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type or not mime_type.startswith('audio/'):
                return {"valid": False, "error": f"File doesn't appear to be audio: {mime_type}"}

            return {"valid": True, "format": file_extension}

        except Exception as e:
            return {"valid": False, "error": str(e)}

    def _format_transcription(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Format the transcription results into the specified structure.
        """
        current_time = datetime.now(timezone.utc).isoformat()
        
        # First try to get utterances
        utterances = result.get("results", {}).get("utterances", [])
        
        if utterances:
            # Format each utterance according to the specified structure
            formatted_utterances = []
            for utt in utterances:
                # Get text from either 'text' or 'transcript' field
                text = utt.get("text") or utt.get("transcript", "")
                if not text and "alternatives" in utt:
                    text = utt["alternatives"][0].get("transcript", "")
                
                formatted_utterances.append({
                    "timestamp": current_time,
                    "start": round(utt.get("start", 0), 2),
                    "end": round(utt.get("end", 0), 2),
                    "text": text,
                    "speaker": utt.get("speaker", 0)
                })
            return formatted_utterances
        
        # If no utterances, try to get transcript from alternatives
        channels = result.get("results", {}).get("channels", [])
        if channels and "alternatives" in channels[0]:
            transcript = channels[0]["alternatives"][0].get("transcript", "")
            if transcript:
                return [{
                    "timestamp": current_time,
                    "start": 0.0,
                    "end": 0.0,
                    "text": transcript,
                    "speaker": 0
                }]
        
        # If still no transcript found, return empty text
        logger.warning("No transcript found in the response")
        return [{
            "timestamp": current_time,
            "start": 0.0,
            "end": 0.0,
            "text": "",
            "speaker": 0
        }]

    def transcribe_audio(self, file_path: str, language: str = "en") -> Dict[str, Any]:
        """
        Transcribe audio file and return results in a standardized format.
        
        Args:
            file_path (str): Path to the audio file
            language (str): Language code for transcription (default: "en")
            
        Returns:
            Dict containing transcription results and metadata
        """
        start_time = time.time()
        
        # Validate the audio file
        validation = self.validate_audio_file(file_path)
        if not validation.get("valid", False):
            return {"error": f"Invalid audio file: {validation.get('error')}"}

        try:
            # Read and transcribe the audio file
            with open(file_path, "rb") as audio:
                source = {
                    "buffer": audio.read(),
                    "mimetype": "audio/wav" if file_path.endswith(".wav") else "audio/mpeg"
                }

            options = {
                "punctuate": True,
                "language": language,
                "model": "nova-3-medical",
                "smart_format": True,
                "diarize": True,
                "utterances": True
            }

            # Perform transcription
            response = self.dg_client.listen.rest.v("1").transcribe_file(source, options, timeout=300)
            result = response.to_dict()

            # Log the raw response for debugging
            logger.debug(f"Raw Deepgram response: {json.dumps(result, indent=2)}")

            # Format transcription results
            transcription_results = self._format_transcription(result)

            # Calculate word count from all utterances
            word_count = sum(len(utt.get("text", "").split()) for utt in transcription_results)

            # Get audio duration from the last utterance or default to 0
            audio_duration = transcription_results[-1].get("end", 0) if transcription_results else 0

            # Format the response
            return {
                "transcription": transcription_results,
                "metadata": {
                    "filename": os.path.basename(file_path),
                    "language": language,
                    "duration_seconds": round(audio_duration, 2),
                    "word_count": word_count,
                    "transcription_time": round(time.time() - start_time, 2)
                }
            }

        except Exception as e:
            logger.error(f"Error during transcription: {str(e)}")
            return {"error": f"Transcription failed: {str(e)}"}

if __name__ == "__main__":
    # Example usage
    api_key = os.getenv("DEEPGRAM_API_KEY")
    transcriber = DeepgramTranscriber(api_key)
    
    # Replace with your audio file path
    audio_file = r"path/to/audio/file.wav"
    
    if os.path.exists(audio_file):
        result = transcriber.transcribe_audio(audio_file)
        with open("transcription.json", "w") as f:
            json.dump(result, f, indent=2)
    else:
        print(f"Audio file not found: {audio_file}")
