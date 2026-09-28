import os
import json
import time
import logging
import requests
import mimetypes
import tempfile
from openai import AzureOpenAI
from dotenv import load_dotenv
from deepgram import DeepgramClient
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import subprocess
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed

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
        self.llm_client = AzureOpenAI(
            api_key=os.getenv("LLM_API_KEY"),
            azure_endpoint=os.getenv("LLM_API_ENDPOINT"),
            api_version="2024-02-15-preview"  # Ensure this matches your Azure OpenAI API version
        )
        # Check if ffmpeg is available for audio processing
        self.ffmpeg_available = self._check_ffmpeg_availability()

    def _check_ffmpeg_availability(self) -> bool:
        """Check if ffmpeg is available in the system."""
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("ffmpeg not found. Audio chunking will not be available.")
            return False

    def _get_audio_duration(self, file_path: str) -> float:
        """Get the duration of an audio file using ffmpeg."""
        if not self.ffmpeg_available:
            return 0.0
        
        try:
            cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            file_path
           ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            data = json.loads(result.stdout)
            
            # Duration in seconds (float)
            duration = float(data['format']['duration'])
            return duration
        except Exception as e:
            logger.error(f"Error getting audio duration: {e}")
        
        return 0.0

    def _split_audio_file(self, file_path: str, chunk_duration: int = 1200) -> List[str]:
        """
        Split audio file into chunks of specified duration (in seconds).
        
        Args:
            file_path: Path to the audio file
            chunk_duration: Duration of each chunk in seconds (default: 20 minutes)

        Returns:
            List of paths to chunk files
        """
        if not self.ffmpeg_available:
            raise RuntimeError("ffmpeg is required for audio chunking but not available")
        
        chunk_files = []
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Get total duration
            total_duration = self._get_audio_duration(file_path)
            if total_duration == 0:
                raise ValueError("Could not determine audio duration")
            
            # Calculate number of chunks needed
            num_chunks = int((total_duration + chunk_duration - 1) // chunk_duration)
            
            logger.info(f"Splitting {file_path} into {num_chunks} chunks of {chunk_duration}s each")
            
            for i in range(num_chunks):
                start_time = i * chunk_duration
                chunk_file = os.path.join(temp_dir, f"chunk_{i:03d}.wav")
                
                # Use ffmpeg to extract chunk
                cmd = [
                    'ffmpeg', '-i', file_path,
                    '-ss', str(start_time),
                    '-t', str(chunk_duration),
                    '-c', 'copy',
                    '-y',  # Overwrite output files
                    chunk_file
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode == 0 and os.path.exists(chunk_file):
                    chunk_files.append(chunk_file)
                    logger.info(f"Created chunk {i+1}/{num_chunks}: {chunk_file}")
                else:
                    logger.error(f"Failed to create chunk {i+1}: {result.stderr}")
            
            return chunk_files
            
        except Exception as e:
            # Clean up temp files on error
            for chunk_file in chunk_files:
                if os.path.exists(chunk_file):
                    os.remove(chunk_file)
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            raise e

    def _combine_transcriptions(self, chunk_results: List[Dict[str, Any]], chunk_duration: int = 300) -> List[Dict[str, Any]]:
        """
        Combine transcription results from multiple chunks into a single coherent transcription.
        
        Args:
            chunk_results: List of transcription results from each chunk
            chunk_duration: Duration of each chunk in seconds
            
        Returns:
            Combined transcription results
        """
        combined_utterances = []
        current_time = datetime.now(timezone.utc).isoformat()
        
        for chunk_index, chunk_result in enumerate(chunk_results):
            if "transcription" not in chunk_result:
                logger.warning(f"Chunk {chunk_index} has no transcription data")
                continue
                
            time_offset = chunk_index * chunk_duration
            
            for utterance in chunk_result["transcription"]:
                # Adjust timestamps to account for chunk position
                adjusted_utterance = {
                    "timestamp": current_time,
                    "start": round(utterance.get("start", 0) + time_offset, 2),
                    "end": round(utterance.get("end", 0) + time_offset, 2),
                    "text": utterance.get("text", ""),
                    "speaker": utterance.get("speaker", 0)
                }
                combined_utterances.append(adjusted_utterance)
        
        return combined_utterances

    def _cleanup_chunk_files(self, chunk_files: List[str]):
        """Clean up temporary chunk files."""
        temp_dir = None
        for chunk_file in chunk_files:
            if os.path.exists(chunk_file):
                if temp_dir is None:
                    temp_dir = os.path.dirname(chunk_file)
                os.remove(chunk_file)
        
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Could not remove temp directory {temp_dir}: {e}")

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
        If file is larger than 80MB, it will be split into chunks and transcribed separately.
        
        Args:
            file_path (str): Path to the audio file
            language (str): Language code for transcription (default: "en")
            
        Returns:
            Dict containing transcription results and metadata
        """
        print(f"Transcribing audio file: {file_path} with language: {language}")
        start_time = time.time()
        
        # Validate the audio file
        # validation = self.validate_audio_file(file_path)
        # print(f"Validation result: {validation}")
        # if not validation.get("valid", False):
        #     return {"error": f"Invalid audio file: {validation.get('error')}"}
        
        # Check file size for chunking
        file_size = os.path.getsize(file_path)
        file_size_mb = file_size / (1024 * 1024)
        chunk_files = []
        
        try:
            print(f"File size: {file_size_mb:.2f}MB")
            if file_size_mb > 80:
                logger.info(f"File size ({file_size_mb:.2f}MB) exceeds 80MB limit. Splitting into chunks...")
                
                if not self.ffmpeg_available:
                    return {"error": "File is too large (>80MB) and ffmpeg is not available for chunking"}
                
                # Split audio into chunks
                chunk_files = self._split_audio_file(file_path)
                if not chunk_files:
                    return {"error": "Failed to split audio file into chunks"}
                
                # Transcribe chunks in parallel with optimized worker count
                # Use more workers for better parallelism, but cap at 8 to avoid overwhelming APIs
                max_workers = min(len(chunk_files), 8)
                
                logger.info(f"Starting parallel transcription of {len(chunk_files)} chunks with {max_workers} workers")
                
                # Pre-allocate results list to maintain order
                chunk_results = [None] * len(chunk_files)
                
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    # Submit all transcription tasks with their indices
                    future_to_chunk = {
                        executor.submit(self._transcribe_single_file, chunk_file, language): (i, chunk_file)
                        for i, chunk_file in enumerate(chunk_files)
                    }
                    
                    # Collect results as they complete and maintain order
                    for future in as_completed(future_to_chunk):
                        chunk_index, chunk_file = future_to_chunk[future]
                        try:
                            chunk_result = future.result()
                            chunk_results[chunk_index] = chunk_result
                            logger.info(f"Completed transcription of chunk {chunk_index + 1}/{len(chunk_files)}: {chunk_file}")
                            
                            # Check for errors in chunk transcription
                            if "error" in chunk_result:
                                logger.error(f"Error transcribing chunk {chunk_index + 1}: {chunk_result['error']}")
                        except Exception as e:
                            logger.error(f"Exception occurred while transcribing chunk {chunk_index + 1}: {str(e)}")
                            # Add error result to maintain chunk order
                            chunk_results[chunk_index] = {"error": f"Transcription failed: {str(e)}"}
                
                # Filter out None results (shouldn't happen with proper indexing)
                chunk_results = [result for result in chunk_results if result is not None]
                
                # Combine transcription results
                combined_transcription = self._combine_transcriptions(chunk_results)
                
                # Calculate metadata
                word_count = sum(len(utt.get("text", "").split()) for utt in combined_transcription)
                audio_duration = combined_transcription[-1].get("end", 0) if combined_transcription else 0
                
                return {
                    "transcription": combined_transcription,
                    "metadata": {
                        "filename": os.path.basename(file_path),
                        "language": language,
                        "duration_seconds": round(audio_duration, 2),
                        "word_count": word_count,
                        "transcription_time": round(time.time() - start_time, 2),
                        "chunked": True,
                        "num_chunks": len(chunk_files),
                        "file_size_mb": round(file_size_mb, 2)
                    }
                }
            else:
                # File is small enough, transcribe normally
                logger.info(f"File size ({file_size_mb:.2f}MB) is within limits. Transcribing normally...")
                return self._transcribe_single_file(file_path, language, start_time)
                
        except Exception as e:
            print(f"Error during transcription: {str(e)}, file_size_mb: {file_size_mb:.2f}MB")
            logger.error(f"Error during transcription-deepgram: {str(e)}")
            return {"error": f"Transcription failed: {str(e)}"}
        finally:
            # Clean up chunk files
            if chunk_files:
                self._cleanup_chunk_files(chunk_files)

    def _transcribe_single_file(self, file_path: str, language: str = "en", start_time: Optional[float] = None) -> Dict[str, Any]:
        """
        Transcribe a single audio file (internal method).
        
        Args:
            file_path: Path to the audio file
            language: Language code for transcription
            start_time: Start time for timing calculation (if None, will be set to current time)
            
        Returns:
            Dict containing transcription results and metadata
        """
        if start_time is None:
            start_time = time.time()
            
        try:
            # Read and transcribe the audio file
            with open(file_path, "rb") as audio:
                source = {
                    "buffer": audio.read(),
                    "mimetype": "audio/wav" if file_path.endswith(".wav") else "audio/mpeg"
                }
            options = {
                "punctuate": True,
                "language": 'en-US',
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
                    "transcription_time": round(time.time() - start_time, 2),
                    "chunked": False
                }
            }
        except Exception as e:
            logger.error(f"Error during transcription: {str(e)}")
            return {"error": f"Transcription failed: {str(e)}"}
        
    def contains_medical_terms(self, transcription: str, deployment_name: str = "gpt-4o-mini") -> bool:
        prompt = (
        "You are a language analysis expert with over 15 years of experience in identifying medical terminology "
        "and evaluating written content for medical relevance. Your task is to analyze the following text to determine "
        "whether it contains any of the following:\n"
        "- Medical terms or jargon\n"
        "- Descriptions of medical conditions, symptoms, or diseases\n"
        "- Discussions involving medication, treatment, or diagnostics\n"
        "- Conversations between healthcare professionals and patients\n"
        "- Dictation typical of medical scribes\n\n"
        "Does the text contain any medical-related content?\n"
        "Please respond strictly with either 'YES' or 'NO'. Do not provide explanations or summaries.\n\n"
        f"Text:\n{transcription}"
        )
        response = self.llm_client.chat.completions.create(
            model=deployment_name, 
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3,
            temperature=0
        )
        answer = response.choices[0].message.content.strip().upper()
        return answer == "YES"
    
    def contains_medical_terms_optimized(self, transcription: str, deployment_name: str = "gpt-4o-mini") -> bool:
        """
        Optimized version that uses a more efficient approach for very long transcriptions.
        Instead of checking every chunk, it uses a sampling approach with enhanced parallel processing.
        
        Args:
            transcription: Full transcription text
            deployment_name: LLM model to use for analysis
            
        Returns:
            True if medical terms are found, False otherwise
        """
        if not transcription or not transcription.strip():
            return False
        
        # For very long transcriptions, use a sampling approach
        text_length = len(transcription)
        print(f"Transcription length: {text_length} characters")
        logger.info(f"Transcription length: {text_length} characters")
        
        if text_length <= 5000:
            # For shorter texts, check the entire content
            return self.contains_medical_terms(transcription, deployment_name)
        
        # For longer texts, sample different parts with improved sampling strategy
        samples = []
        
        # Sample from the beginning (first 3000 chars)
        samples.append(transcription[:3000])
        
        # Sample from the middle (middle 3000 chars)
        middle_start = max(0, (text_length - 3000) // 2)
        samples.append(transcription[middle_start:middle_start + 3000])
        
        # Sample from the end (last 3000 chars)
        samples.append(transcription[-3000:])
        
        # If text is very long, add more samples for better coverage
        if text_length > 15000:
            # Add a sample from 1/4 and 3/4 positions
            quarter_start = max(0, text_length // 4 - 1500)
            samples.append(transcription[quarter_start:quarter_start + 3000])
            
            three_quarter_start = max(0, (3 * text_length) // 4 - 1500)
            samples.append(transcription[three_quarter_start:three_quarter_start + 3000])
        
        # For very long texts, add even more samples
        if text_length > 30000:
            # Add samples from 1/6, 2/6, 4/6, 5/6 positions
            for i in [1, 2, 4, 5]:
                pos_start = max(0, (i * text_length) // 6 - 1500)
                samples.append(transcription[pos_start:pos_start + 3000])
        
        logger.info(f"Using optimized sampling approach with {len(samples)} samples for {text_length} character text")
        
        # Check samples for medical content in parallel with increased workers
        # Use more workers for better parallelism, but cap at 6 for LLM API calls
        max_workers = min(len(samples), 6)
        
        logger.info(f"Starting parallel medical content analysis of {len(samples)} samples with {max_workers} workers")
        
        def check_sample_medical_content(sample_text: str, sample_index: int) -> tuple[int, bool]:
            """Helper function to check if a sample contains medical content."""
            try:
                prompt = (
                    "You are a language analysis expert with over 15 years of experience in identifying medical terminology "
                    "and evaluating written content for medical relevance. Your task is to analyze the following text to determine "
                    "whether it contains any of the following:\n"
                    "- Medical terms or jargon\n"
                    "- Descriptions of medical conditions, symptoms, or diseases\n"
                    "- Discussions involving medication, treatment, or diagnostics\n"
                    "- Conversations between healthcare professionals and patients\n"
                    "- Dictation typical of medical scribes\n\n"
                    "Does the text contain any medical-related content?\n"
                    "Please respond strictly with either 'YES' or 'NO'. Do not provide explanations or summaries.\n\n"
                    f"Text:\n{sample_text}"
                )
                
                response = self.llm_client.chat.completions.create(
                    model=deployment_name, 
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=3,
                    temperature=0
                )
                
                answer = response.choices[0].message.content.strip().upper()
                has_medical_content = answer == "YES"
                
                if has_medical_content:
                    logger.info(f"Medical content found in sample {sample_index + 1}/{len(samples)}")
                
                return sample_index, has_medical_content
                
            except Exception as e:
                logger.error(f"Error analyzing sample {sample_index + 1}: {str(e)}")
                return sample_index, False
        
        # Use ThreadPoolExecutor for parallel processing with early termination
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all medical content check tasks
            future_to_sample = {
                executor.submit(check_sample_medical_content, sample, i): i
                for i, sample in enumerate(samples)
            }
            
            # Check results as they complete with early termination
            for future in as_completed(future_to_sample):
                sample_index = future_to_sample[future]
                try:
                    _, has_medical_content = future.result()
                    if has_medical_content:
                        # Cancel remaining tasks since we found medical content
                        for remaining_future in future_to_sample:
                            if not remaining_future.done():
                                remaining_future.cancel()
                        return True  # Found medical content, no need to check other samples
                except Exception as e:
                    logger.error(f"Exception occurred while analyzing sample {sample_index + 1}: {str(e)}")
                    continue
        
        logger.info("No medical content found in any sample")
        return False

    def transcribe_multiple_files(self, file_paths: List[str], language: str = "en", max_workers: int = 4) -> List[Dict[str, Any]]:
        """
        Transcribe multiple audio files in parallel.
        
        Args:
            file_paths: List of audio file paths to transcribe
            language: Language code for transcription (default: "en")
            max_workers: Maximum number of parallel workers (default: 4)
            
        Returns:
            List of transcription results in the same order as input files
        """
        if not file_paths:
            return []
        
        logger.info(f"Starting parallel transcription of {len(file_paths)} files with {max_workers} workers")
        
        # Pre-allocate results list to maintain order
        results = [None] * len(file_paths)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all transcription tasks
            future_to_file = {
                executor.submit(self.transcribe_audio, file_path, language): (i, file_path)
                for i, file_path in enumerate(file_paths)
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_file):
                file_index, file_path = future_to_file[future]
                try:
                    result = future.result()
                    results[file_index] = result
                    logger.info(f"Completed transcription of file {file_index + 1}/{len(file_paths)}: {file_path}")
                    
                    # Check for errors
                    if "error" in result:
                        logger.error(f"Error transcribing file {file_index + 1}: {result['error']}")
                except Exception as e:
                    logger.error(f"Exception occurred while transcribing file {file_index + 1}: {str(e)}")
                    results[file_index] = {"error": f"Transcription failed: {str(e)}"}
        
        # Filter out None results (shouldn't happen with proper indexing)
        results = [result for result in results if result is not None]
        
        return results

    def check_multiple_transcriptions_medical_content(self, transcriptions: List[str], deployment_name: str = "gpt-4o-mini", max_workers: int = 6) -> List[bool]:
        """
        Check multiple transcriptions for medical content in parallel.
        
        Args:
            transcriptions: List of transcription texts to check
            deployment_name: LLM model to use for analysis
            max_workers: Maximum number of parallel workers (default: 6)
            
        Returns:
            List of boolean results indicating medical content presence
        """
        if not transcriptions:
            return []
        
        logger.info(f"Starting parallel medical content analysis of {len(transcriptions)} transcriptions with {max_workers} workers")
        
        # Pre-allocate results list to maintain order
        results = [None] * len(transcriptions)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all medical content check tasks
            future_to_transcription = {
                executor.submit(self.contains_medical_terms_optimized, transcription, deployment_name): (i, transcription)
                for i, transcription in enumerate(transcriptions)
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_transcription):
                transcription_index, transcription = future_to_transcription[future]
                try:
                    has_medical_content = future.result()
                    results[transcription_index] = has_medical_content
                    logger.info(f"Completed medical content analysis of transcription {transcription_index + 1}/{len(transcriptions)}")
                except Exception as e:
                    logger.error(f"Exception occurred while analyzing transcription {transcription_index + 1}: {str(e)}")
                    results[transcription_index] = False  # Default to False on error
        
        # Filter out None results (shouldn't happen with proper indexing)
        results = [result for result in results if result is not None]
        
        return results


if __name__ == "__main__":
    # Example usage
    api_key = os.getenv("DEEPGRAM_API_KEY")
    transcriber = DeepgramTranscriber(api_key)
    
    # Example 1: Single file transcription with medical content check
    audio_file = r"C:\Users\Shivam\Downloads\20250811102247.wav"
    if os.path.exists(audio_file):
        print("=== Single File Transcription Example ===")
        result = transcriber.transcribe_audio(audio_file)
        # Combine all utterance texts for medical check
        if "transcription" in result:
            all_text = " ".join([utt["text"] for utt in result["transcription"] if utt["text"]])
            if not transcriber.contains_medical_terms_optimized(all_text):
                print("NO medical discussion found")
                # Optionally, write this to a file or handle as needed
                with open("transcription.json", "w") as f:
                    json.dump({"output": "NO medical discussion found"}, f, indent=2)
            else:
                # Proceed with existing logic 
                with open("transcription.json", "w") as f:
                    json.dump(result, f, indent=2)
        else:
            print("Transcription failed or not found.")
    else:
        print(f"Audio file not found: {audio_file}")
    
    # Example 2: Multiple file transcription in parallel (if multiple files exist)
    audio_files = [
        r"C:\Users\Shivam\Downloads\20250811102247.wav",
        # Add more file paths here if available
    ]
    
    # Filter to only existing files
    existing_files = [f for f in audio_files if os.path.exists(f)]
    
    if len(existing_files) > 1:
        print("\n=== Multiple File Parallel Transcription Example ===")
        results = transcriber.transcribe_multiple_files(existing_files)
        
        # Extract transcriptions for medical content check
        transcriptions = []
        for result in results:
            if "transcription" in result:
                all_text = " ".join([utt["text"] for utt in result["transcription"] if utt["text"]])
                transcriptions.append(all_text)
            else:
                transcriptions.append("")
        
        # Check medical content in parallel
        medical_results = transcriber.check_multiple_transcriptions_medical_content(transcriptions)
        
        # Process results
        for i, (file_path, has_medical) in enumerate(zip(existing_files, medical_results)):
            print(f"File {i+1}: {os.path.basename(file_path)} - Medical content: {'YES' if has_medical else 'NO'}")
    
    # Example 3: Batch processing demonstration
    print("\n=== Batch Processing Capabilities ===")
    print("Available parallel processing methods:")
    print("1. transcribe_audio() - Single file with automatic chunking")
    print("2. transcribe_multiple_files() - Multiple files in parallel")
    print("3. contains_medical_terms_optimized() - Medical content check with sampling")
    print("4. check_multiple_transcriptions_medical_content() - Multiple medical checks in parallel")
    print("\nKey improvements:")
    print("- Increased worker count for transcription chunks (up to 8 workers)")
    print("- Enhanced sampling strategy for long transcriptions")
    print("- Early termination when medical content is found")
    print("- Optimized result collection and ordering")
    print("- Better error handling and logging")
