import json
import os
import logging
import math
from typing import Dict, Any, Optional, List, Union, Tuple
from uuid import UUID
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import template model
from app.database import SessionLocal
from app.v2.models.template import TemplateModel

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class NoteGenerator:
    """
    Class to generate structured medical notes from healthcare data and transcriptions.
    Uses Azure OpenAI services to create formatted notes based on SOAP format or other 
    medical note templates.
    
    This class processes the structured healthcare data extracted from text analysis
    and the original conversation transcript to generate comprehensive, medically
    accurate notes in various formats (SOAP, Progress Notes, etc.).
    """
    
    def __init__(self, 
                 api_key: Optional[str] = None, 
                 endpoint: Optional[str] = None,
                 config_path: Optional[str] = None,
                 db: Optional[Session] = None):
        """
        Initialize the note generator with Azure OpenAI credentials.
        
        Args:
            api_key: Azure OpenAI API key. If None, uses LLM_API_KEY from env.
            endpoint: Azure OpenAI endpoint. If None, uses LLM_API_URL from env.
            config_path: Path to the note types configuration JSON file.
            db: SQLAlchemy database session for fetching custom templates.
        """
        self.api_key = api_key or os.getenv("LLM_API_KEY")
        self.endpoint = endpoint or os.getenv("LLM_API_URL")
        self.api_version = os.getenv("LLM_API_VERSION", "2024-02-01")
        self.db = db
        
        if not self.api_key or not self.endpoint:
            raise ValueError("Azure OpenAI credentials are required. Set environment variables or pass them to the constructor.")
        
        # Initialize Azure OpenAI client
        self.client = AzureOpenAI(
            api_key=self.api_key,
            api_version=self.api_version,
            azure_endpoint=self.endpoint
        )
        
        # Load note type configurations
        self.config_path = config_path or os.path.join(os.path.dirname(__file__), 'configs', 'note_config.json')
        self.note_configurations = {"note_types": {}}
        self._load_note_configurations()
        
        logger.info(f"Initialized NoteGenerator with config from {self.config_path}")
    
    def _load_note_configurations(self):
        """Load note type configurations from the JSON file."""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    self.note_configurations = json.load(f)
                    logger.info(f"Loaded {len(self.note_configurations.get('note_types', {}))} note type configurations")
            else:
                logger.warning(f"Configuration file {self.config_path} not found. Using default configurations.")
                self.note_configurations = self._get_default_configurations()
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing configuration file {self.config_path}: {str(e)}. Using default configurations.")
            self.note_configurations = self._get_default_configurations()
        except Exception as e:
            logger.error(f"Unexpected error loading configurations: {str(e)}. Using default configurations.")
            self.note_configurations = self._get_default_configurations()
    
    def _get_default_configurations(self) -> Dict[str, Any]:
        """
        Load default note type configurations from a fallback JSON file.
        This is used when the primary config file is not found or has errors.
        """
        # Try multiple possible locations for the default config
        possible_paths = [
            os.path.join(os.path.dirname(__file__), 'configs', 'default_note_config.json'),
            os.path.join(os.path.dirname(__file__), 'configs', 'note_config_default.json'),
            os.path.join(os.path.dirname(__file__), '..', 'configs', 'note_config.json'),
            '/app/configs/note_config.json',  # Docker/deployment path
            './configs/note_config.json'  # Relative path
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        config = json.load(f)
                        logger.info(f"Loaded default configurations from: {path}")
                        return config
                except Exception as e:
                    logger.error(f"Error loading default config from {path}: {str(e)}")
                    continue
        
        # If no config file is found, return minimal configuration
        logger.error("No default configuration file found. Using minimal configuration.")
        return {
            "note_types": {
                "soap": {
                    "structure": "SOAP (Subjective, Objective, Assessment, Plan) format",
                    "sections": ["Chief Complaint", "Subjective", "Objective", "Assessment", "Plan"],
                    "system_prompt_addition": "\nFocus on creating a clear SOAP note with distinct sections.",
                    "specific_instructions": "Organize the note following SOAP structure strictly."
                },
                "progress": {
                    "structure": "Progress Note format",
                    "sections": ["Date and Time", "Progress Summary", "Current Status", "Next Steps"],
                    "system_prompt_addition": "\nFocus on documenting patient progress and changes since last visit.",
                    "specific_instructions": "Emphasize changes in condition and response to treatment."
                }
            }
        }
    
    def _get_custom_template(self, template_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Fetches a custom template from the database based on the template ID.
        
        Args:
            template_id: UUID of the custom template to fetch
            
        Returns:
            Dictionary containing template information or None if not found
        """
        if not self.db:
            logger.warning("Database session not available. Cannot fetch custom template.")
            return None
            
        try:
            template = self.db.query(TemplateModel).filter(
                TemplateModel.template_id == template_id,
                TemplateModel.is_active == True
            ).first()
            
            if not template:
                logger.warning(f"Custom template with ID {template_id} not found or inactive.")
                return None 
                
            # Convert template model to dictionary format compatible with note_configurations
            template_dict = {
                "name": template.name,
                "structure": template.structure,
                "sections": template.sections if isinstance(template.sections, list) else [],
                "system_prompt_addition": template.system_prompt or "",
                "specific_instructions": template.specific_instructions or ""
            }
            
            logger.info(f"Found custom template: {template.name}")
            return template_dict
            
        except Exception as e:
            logger.error(f"Error fetching custom template: {str(e)}")
            return None
    
    def generate_note(
        self,
        analytics_data: Union[str, Dict[str, Any]],
        transcription: str,
        note_type: str,
        deployment_name: str = "gpt-4o-mini",
        provider_id: Optional[int] = None,
        template_id: Optional[UUID] = None,
        max_workers: int = 3
    ) -> Dict[str, Any]:
        """
        Main method to generate a medical note from analytics data and transcription.
        
        This method handles the logic for:
        1. If note_type is "CUSTOM" and template_id is provided, fetch and use the custom template
        2. Otherwise, use the predefined note type configurations from note_config.json
        3. Automatically process long transcriptions to fit within token limits while maintaining context
        
        Args:
            analytics_data: Healthcare data from text analysis (JSON string or dict)
            transcription: Transcription of the conversation
            note_type: Type of note to generate (e.g., "SOAP", "PROGRESS", "CUSTOM")
            deployment_name: Azure OpenAI model to use
            provider_id: ID of the provider (not used in current implementation)
            template_id: UUID of custom template to use when note_type is "CUSTOM"
            max_workers: Number of parallel workers for processing long transcriptions
            
        Returns:
            Dictionary containing the structured note with sections
        """
        # Process input data
        if isinstance(analytics_data, str):
            try:
                healthcare_data = json.loads(analytics_data)
            except json.JSONDecodeError:
                logger.error("Failed to parse analytics data as JSON")
                healthcare_data = {}
        else:
            healthcare_data = analytics_data or {}
        
        logger.info(f"Generating {note_type} note from transcription: {len(transcription)} chars, analytics: {len(str(healthcare_data))} chars")
        
        # Process long transcription if needed
        original_transcription_length = len(transcription)
        processed_transcription = self._process_long_transcription(transcription, deployment_name, max_workers)
        
        if len(processed_transcription) != original_transcription_length:
            logger.info(f"Transcription processed: {original_transcription_length} -> {len(processed_transcription)} characters")
        
        # Determine if we should use a custom template
        use_custom_template = False
        custom_template = None
        
        if template_id:
            # Fetch the custom template from database
            custom_template = self._get_custom_template(template_id)
            if custom_template:
                use_custom_template = True
                logger.info(f"Using custom template: {custom_template['name']}")
            else:
                logger.error(f"Custom template with ID {template_id} not found. Falling back to default.")
                return {"error": f"Custom template with ID {template_id} not found"}
        
        # Extract healthcare information
        extracted_data = self._extract_healthcare_information(healthcare_data)
        
        # Get structure guidance and system prompt based on template type
        if use_custom_template:
            # Use custom template configuration
            structure_guidance = {
                "structure": custom_template["structure"],
                "sections": custom_template["sections"]
            }
            system_prompt = self._get_base_system_prompt() + "\n" + custom_template.get("system_prompt_addition", "")
            specific_instructions = custom_template.get("specific_instructions", "")
            effective_note_type = custom_template["structure"]
        else:
            # Use predefined note type configuration
            note_config = self._get_note_type_config(note_type)
            structure_guidance = {
                "structure": note_config.get("structure", f"{note_type} format"),
                "sections": note_config.get("sections", self._get_default_sections())
            }
            system_prompt = self._get_base_system_prompt() + "\n" + note_config.get("system_prompt_addition", "")
            specific_instructions = note_config.get("specific_instructions", "")
            effective_note_type = note_type
        
        # Create the prompt using the processed transcription
        prompt = self._create_prompt(
            extracted_data,
            processed_transcription,
            effective_note_type,
            structure_guidance,
            specific_instructions
        )
        
        try:
            # Send request to Azure OpenAI
            logger.info(f"Sending request to Azure OpenAI using {deployment_name} model")
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            response = self.client.chat.completions.create(
                model=deployment_name,
                messages=messages,
                temperature=0.1,
                max_tokens=4000
            )
            
            # Process and return the response
            result = self._process_response(response)
            
            # Add metadata about the template used and transcription processing
            if use_custom_template:
                result["template_used"] = {
                    "type": "custom",
                    "template_id": str(template_id),
                    "template_name": custom_template["name"]
                }
            else:
                result["template_used"] = {
                    "type": "predefined",
                    "note_type": note_type
                }
            
            # Add transcription processing metadata
            result["transcription_processing"] = {
                "original_length": original_transcription_length,
                "processed_length": len(processed_transcription),
                "was_processed": original_transcription_length != len(processed_transcription),
                "processing_method": "chunking_and_summarization" if original_transcription_length != len(processed_transcription) else "none"
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating medical note: {str(e)}")
            return {"error": str(e)}
    
    def _get_note_type_config(self, note_type: str) -> Dict[str, Any]:
        """
        Get configuration for a specific note type from the loaded configurations.
        
        Args:
            note_type: The note type to get configuration for
            
        Returns:
            Configuration dictionary for the note type
        """
        # Normalize the note type key
        note_type_key = note_type.lower().replace(" ", "_").replace("-", "_")
        
        # Get note types from configuration
        note_types = self.note_configurations.get("note_types", {})
        
        # Try exact match first
        if note_type_key in note_types:
            return note_types[note_type_key]
        
        # Try partial match
        for config_key, config in note_types.items():
            if config_key in note_type_key or note_type_key in config_key:
                return config
        
        # Return empty config if not found
        logger.warning(f"No configuration found for note type: {note_type}")
        return {}
    
    def _get_base_system_prompt(self) -> str:
        """
        Get the base system prompt without note-type specific additions.
        
        Returns:
            Base system prompt string
        """
        return """You are an expert medical documentation specialist with extensive experience in clinical documentation.
Your task is to create comprehensive, medically accurate documentation that follows standard medical notation and terminology.
Your notes should be:

1. COMPREHENSIVE - Include all relevant clinical information with appropriate detail
2. STRUCTURED - Follow standard medical documentation formats with clear section headings
3. PRECISE - Use specific medical terminology, accurate ICD-10 codes, and proper medical abbreviations
4. EVIDENCE-BASED - Include only information that is supported by the provided data
5. CONCISE YET THOROUGH - Avoid unnecessary repetition while ensuring all pertinent information is included

When documenting findings, assessments, and plans:
- Use proper medical terminology and standard medical abbreviations when appropriate
- Include relevant positive and negative findings
- Document with appropriate specificity (laterality, severity, chronicity)
- Organize information logically within each section
- Ensure proper connection between symptoms, findings, assessments, and plans
- Include appropriate level of detail for medication information (names, dosages, frequency, routes)
- Document appropriate follow-up plans and timeframes

DO NOT invent or assume information not present in the provided data."""
    
    def _create_prompt(self, extracted_data: Dict[str, Any], conversation_transcript: str, 
                      note_type: str, structure_guidance: Dict[str, Any], 
                      specific_instructions: str) -> str:
        """Create a detailed prompt for the LLM to generate a comprehensive medical note."""
        prompt = f"""
# TASK
Generate a detailed, comprehensive {note_type} based on the provided healthcare data and conversation transcript.

# NOTE TYPE INFORMATION
This is a {structure_guidance["structure"]} that should follow standard medical documentation practices.

# REQUIRED SECTIONS
The note must include these sections based on the {note_type} format:
{', '.join(structure_guidance["sections"])}

# IMPORTANT GUIDELINES
- DO NOT GENERATE anything based on information not present in the provided data
- respond with 'This subject was not addressed in the conversation.' if any section cannot be completed due to lack of information
- Include all relevant information from the data sources
- Use specific medical terminology rather than general statements
- Include appropriate level of detail for a professional medical note
- Organize content logically within each section
- Follow standard medical documentation practices for the specified note type
- Ensure the note would be acceptable in a clinical setting by medical professionals

# DETAILED INSTRUCTIONS
1. STRUCTURE: Follow the standard medical structure for a {note_type}
2. COMPREHENSIVENESS: Include all relevant clinical information from the data provided
3. MEDICAL TERMINOLOGY: Use appropriate medical terminology and standard abbreviations
4. SPECIFICITY: Be specific about symptoms, findings, and plans (include laterality, severity, timing, etc.)
5. RELEVANT DETAILS: Include all relevant details about:
   - Medications (names, dosages, frequency, route)
   - Vital signs (with specific values)
   - Examination findings (specific observations, not vague statements)
   - Diagnostic results (with specific values and interpretations)
   - Assessment (specific diagnoses with ICD-10 codes when available)
   - Plans (specific treatments, doses, durations, follow-up timeframes)
6. CONNECTION: Ensure clear connections between symptoms, findings, assessments, and plans
7. CLARITY: Write in clear, concise medical language appropriate for professional clinical documentation
8. PRIVACY: Exclude any direct patient identifiers (name, DOB, etc.)

# DATA SOURCES
Use ONLY the information from these sources:

## CONVERSATION TRANSCRIPT:
{conversation_transcript}

# OUTPUT FORMAT
Format your response as a JSON with sections, each having:
- section_name: The name of the section (e.g., "Chief Complaint", "Assessment")
- section_type: The type of information in that section (e.g., "history", "exam", "diagnosis")
- section_preference: The order number (1, 2, 3, etc.)
- content: Should be created in markdown format, detailed, comprehensive content for that section using proper medical formatting, the text should be properly formatted and structured, including appropriate medical terminology and formatting.

The JSON response should follow this exact format:
{{
    "sections": [
        {{
            "section_name": "Section Name",
            "section_type": "Type of Information",
            "section_preference": 1,
            "content": "Detailed content with appropriate medical terminology and formatting..."
        }},
        ...
    ]
}}

"""
        
        # Add specific instructions if provided
        if specific_instructions:
            prompt += f"\n\n# ADDITIONAL SPECIFIC INSTRUCTIONS:\n{specific_instructions}"
        
        return prompt
    
    def _extract_healthcare_information(self, healthcare_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract relevant healthcare information from the analysis data.
        
        Args:
            healthcare_data: Raw healthcare data from analysis
            
        Returns:
            Dictionary with extracted healthcare information
        """
        result = {
            "documents": []
        }
        
        # Handle case where healthcare_data might be empty or minimal
        if not healthcare_data:
            logger.info("No healthcare data provided, using empty structure")
            return result
        
        # Extract document information
        if "documents" in healthcare_data:
            for doc in healthcare_data.get("documents", []):
                doc_info = {
                    "healthcare_relations": doc.get("healthcare_relations", []),
                    "key_phrases": doc.get("key_phrases", []),
                }
                result["documents"].append(doc_info)
        else:
            # If no documents key, treat the entire data as a single document
            result["documents"].append({
                "healthcare_relations": healthcare_data.get("healthcare_relations", []),
                "key_phrases": healthcare_data.get("key_phrases", []),
            })
        
        return result
    
    def _process_response(self, response) -> Dict[str, Any]:
        """Process and extract JSON from LLM response."""
        try:
            # Extract the JSON from the response
            response_text = response.choices[0].message.content
            
            # Log the raw response for debugging (first 500 chars)
            logger.debug(f"Raw LLM response: {response_text[:500]}...")
            
            # Find JSON content within the response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                medical_note = json.loads(json_str)
                
                # Validate the response structure
                if "sections" in medical_note and isinstance(medical_note["sections"], list):
                    return medical_note
                else:
                    logger.error("Invalid response structure: missing 'sections' array")
                    return {"error": "Invalid response structure", "raw_response": response_text}
            else:
                # If no JSON found, return the raw text for debugging
                logger.error("No valid JSON found in response")
                return {"error": "No valid JSON found in response", "raw_response": response_text}
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return {"error": f"Failed to parse JSON response: {str(e)}", "raw_response": response_text if 'response_text' in locals() else ""}
        except Exception as e:
            logger.error(f"Unexpected error processing response: {str(e)}")
            return {"error": f"Unexpected error: {str(e)}"}
    
    def _get_default_sections(self) -> List[str]:
        """Return default sections for a general medical note."""
        return [
            "Chief Complaint", 
            "History of Present Illness",
            "Past Medical History",
            "Medications",
            "Allergies",
            "Physical Examination", 
            "Assessment", 
            "Diagnoses",
            "Plan",
            "Follow-up Recommendations"
        ]
    
    def to_json(self, note_data: Dict[str, Any]) -> str:
        """
        Convert note data to formatted JSON.
        
        Args:
            note_data: The note data to convert
            
        Returns:
            Formatted JSON string
        """
        return json.dumps(note_data, indent=2)
    
    def _estimate_tokens(self, text: str) -> int:
        """
        Estimate the number of tokens in a text string.
        Rough approximation: 1 token ≈ 4 characters for English text.
        
        Args:
            text: The text to estimate tokens for
            
        Returns:
            Estimated number of tokens
        """
        return len(text) // 4 + 1200
    
    def _get_max_tokens_for_model(self, deployment_name: str) -> int:
        """
        Get the maximum tokens allowed for a given model.
        
        Args:
            deployment_name: The model deployment name
            
        Returns:
            Maximum tokens allowed for the model
        """
        # Token limits for different models (approximate)
        token_limits = {
            "gpt-4o-mini": 128000,
            "gpt-4o": 128000,
            "gpt-4-turbo": 128000,
            "gpt-4": 8192,
            "gpt-35-turbo": 4096,
            "gpt-35-turbo-16k": 16384
        }
        
        # Try to match the deployment name to known models
        for model_name, limit in token_limits.items():
            if model_name.lower() in deployment_name.lower():
                return limit
        
        # Default to a conservative limit
        return 8000
    
    def _chunk_transcription_intelligently(self, transcription: str, max_chunk_size: int = 6000) -> List[str]:
        """
        Intelligently chunk a long transcription into smaller pieces while preserving context.
        
        Args:
            transcription: The full transcription text
            max_chunk_size: Maximum size of each chunk in characters
            
        Returns:
            List of transcription chunks
        """
        if len(transcription) <= max_chunk_size:
            return [transcription]
        
        chunks = []
        current_chunk = ""
        sentences = transcription.split('. ')
        
        for sentence in sentences:
            # If adding this sentence would exceed the limit, start a new chunk
            if len(current_chunk) + len(sentence) > max_chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = sentence + '. '
            else:
                current_chunk += sentence + '. '
        
        # Add the last chunk if it has content
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _summarize_transcription_chunk(self, chunk: str, deployment_name: str) -> str:
        """
        Summarize a transcription chunk to extract key medical information.
        
        Args:
            chunk: The transcription chunk to summarize
            deployment_name: The model to use for summarization
            
        Returns:
            Summarized medical information from the chunk
        """
        try:
            summary_prompt = f"""
You are a medical documentation specialist. Extract and summarize the key medical information from this conversation segment.

Focus on:
- Chief complaints and symptoms
- Medical history mentioned
- Physical examination findings
- Medications discussed
- Diagnoses or assessments
- Treatment plans
- Follow-up recommendations

Conversation segment:
{chunk}

Provide a concise summary of the medical information in this segment. Use medical terminology and be specific about details like medications, dosages, symptoms, etc.
"""

            response = self.client.chat.completions.create(
                model=deployment_name,
                messages=[
                    {"role": "system", "content": "You are a medical documentation specialist focused on extracting key clinical information."},
                    {"role": "user", "content": summary_prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error summarizing transcription chunk: {str(e)}")
            return chunk  # Return original chunk if summarization fails
    
    def _process_long_transcription(self, transcription: str, deployment_name: str, max_workers: int = 3) -> str:
        """
        Process a long transcription by chunking, summarizing, and combining the results.
        
        Args:
            transcription: The full transcription text
            deployment_name: The model to use for processing
            max_workers: Number of parallel workers for summarization
            
        Returns:
            Processed transcription that maintains context while fitting within token limits
        """
        logger.info(f"Processing long transcription: {len(transcription)} characters")
        
        # Estimate tokens in the full transcription
        estimated_tokens = self._estimate_tokens(transcription)
        max_tokens = self._get_max_tokens_for_model(deployment_name)
        
        # Reserve tokens for prompt and response
        available_tokens = 8000  # Reserve 2000 tokens for prompt and response
        
        if estimated_tokens <= available_tokens:
            logger.info("Transcription fits within token limits, using full text")
            return transcription
        
        # Chunk the transcription intelligently
        chunk_size = int(available_tokens * 0.6 * 4)  # Convert tokens to characters, use 60% of available
        chunks = self._chunk_transcription_intelligently(transcription, chunk_size)
        
        logger.info(f"Split transcription into {len(chunks)} chunks for processing")
        
        # Summarize chunks in parallel
        summaries = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_chunk = {
                executor.submit(self._summarize_transcription_chunk, chunk, deployment_name): i
                for i, chunk in enumerate(chunks)
            }
            
            # Collect summaries in order
            chunk_summaries = [None] * len(chunks)
            for future in as_completed(future_to_chunk):
                chunk_index = future_to_chunk[future]
                try:
                    summary = future.result()
                    chunk_summaries[chunk_index] = summary
                    logger.info(f"Completed summarization of chunk {chunk_index + 1}/{len(chunks)}")
                except Exception as e:
                    logger.error(f"Error summarizing chunk {chunk_index + 1}: {str(e)}")
                    chunk_summaries[chunk_index] = chunks[chunk_index]  # Use original chunk as fallback
        
        # Combine summaries
        combined_summary = "\n\n".join([s for s in chunk_summaries if s])
        
        # If the combined summary is still too long, create a final summary
        if self._estimate_tokens(combined_summary) > available_tokens:
            logger.info("Combined summary still too long, creating final summary")
            combined_summary = self._create_final_summary(combined_summary, deployment_name)
        
        logger.info(f"Final processed transcription: {len(combined_summary)} characters")
        return combined_summary
    
    def _create_final_summary(self, combined_summary: str, deployment_name: str) -> str:
        """
        Create a final summary of the combined summaries to fit within token limits.
        
        Args:
            combined_summary: The combined summaries from all chunks
            deployment_name: The model to use for final summarization
            
        Returns:
            Final summary that fits within token limits
        """
        try:
            final_summary_prompt = f"""
You are a medical documentation specialist. Create a comprehensive but concise summary of the medical information from this conversation.

This summary will be used to generate a complete medical note, so include all critical information:
- Chief complaints and primary symptoms
- Relevant medical history
- Key examination findings
- Medications (names, dosages, frequency)
- Diagnoses or assessments
- Treatment plans
- Follow-up recommendations

Combined conversation information:
{combined_summary}

Provide a comprehensive summary that captures all essential medical information while being concise enough to fit within token limits for note generation.
"""

            response = self.client.chat.completions.create(
                model=deployment_name,
                messages=[
                    {"role": "system", "content": "You are a medical documentation specialist creating comprehensive summaries for note generation."},
                    {"role": "user", "content": final_summary_prompt}
                ],
                temperature=0.1,
                max_tokens=1500
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error creating final summary: {str(e)}")
            # Return a truncated version if final summarization fails
            return combined_summary[:3000] + "..." if len(combined_summary) > 3000 else combined_summary
    
    def generate_multiple_notes(
        self,
        data_list: List[Dict[str, Any]],
        note_type: str,
        deployment_name: str = "gpt-4o-mini",
        template_id: Optional[UUID] = None,
        max_workers: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple medical notes in parallel from a list of data.
        
        Args:
            data_list: List of dictionaries containing:
                - analytics_data: Healthcare data from text analysis
                - transcription: Transcription of the conversation
                - provider_id: (optional) ID of the provider
            note_type: Type of note to generate (e.g., "SOAP", "PROGRESS", "CUSTOM")
            deployment_name: Azure OpenAI model to use
            template_id: UUID of custom template to use when note_type is "CUSTOM"
            max_workers: Number of parallel workers for note generation
            
        Returns:
            List of generated notes in the same order as input data
        """
        if not data_list:
            return []
        
        logger.info(f"Starting parallel generation of {len(data_list)} notes with {max_workers} workers")
        
        # Pre-allocate results list to maintain order
        results = [None] * len(data_list)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all note generation tasks
            future_to_data = {
                executor.submit(
                    self.generate_note,
                    item["analytics_data"],
                    item["transcription"],
                    note_type,
                    deployment_name,
                    item.get("provider_id"),
                    template_id,
                    max_workers=1  # Use 1 worker per individual note generation
                ): (i, item)
                for i, item in enumerate(data_list)
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_data):
                data_index, data_item = future_to_data[future]
                try:
                    result = future.result()
                    results[data_index] = result
                    logger.info(f"Completed note generation {data_index + 1}/{len(data_list)}")
                    
                    # Check for errors
                    if "error" in result:
                        logger.error(f"Error generating note {data_index + 1}: {result['error']}")
                except Exception as e:
                    logger.error(f"Exception occurred while generating note {data_index + 1}: {str(e)}")
                    results[data_index] = {"error": f"Note generation failed: {str(e)}"}
        
        # Filter out None results (shouldn't happen with proper indexing)
        results = [result for result in results if result is not None]
        
        return results
    
    def estimate_token_usage(
        self,
        analytics_data: Union[str, Dict[str, Any]],
        transcription: str,
        note_type: str,
        deployment_name: str = "gpt-4o-mini",
        template_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Estimate token usage for note generation and provide processing recommendations.
        
        Args:
            analytics_data: Healthcare data from text analysis
            transcription: Transcription of the conversation
            note_type: Type of note to generate
            deployment_name: Azure OpenAI model to use
            template_id: UUID of custom template to use
            
        Returns:
            Dictionary containing token estimates and recommendations
        """
        # Process input data
        if isinstance(analytics_data, str):
            try:
                healthcare_data = json.loads(analytics_data)
            except json.JSONDecodeError:
                healthcare_data = {}
        else:
            healthcare_data = analytics_data or {}
        
        # Get template configuration
        use_custom_template = False
        custom_template = None
        
        if template_id:
            custom_template = self._get_custom_template(template_id)
            if custom_template:
                use_custom_template = True
                effective_note_type = custom_template["structure"]
            else:
                return {"error": f"Custom template with ID {template_id} not found"}
        else:
            note_config = self._get_note_type_config(note_type)
            effective_note_type = note_type
        
        # Extract healthcare information
        extracted_data = self._extract_healthcare_information(healthcare_data)
        
        # Get structure guidance
        if use_custom_template:
            structure_guidance = {
                "structure": custom_template["structure"],
                "sections": custom_template["sections"]
            }
            system_prompt = self._get_base_system_prompt() + "\n" + custom_template.get("system_prompt_addition", "")
            specific_instructions = custom_template.get("specific_instructions", "")
        else:
            structure_guidance = {
                "structure": note_config.get("structure", f"{note_type} format"),
                "sections": note_config.get("sections", self._get_default_sections())
            }
            system_prompt = self._get_base_system_prompt() + "\n" + note_config.get("system_prompt_addition", "")
            specific_instructions = note_config.get("specific_instructions", "")
        
        # Create the prompt to estimate its size
        prompt = self._create_prompt(
            extracted_data,
            transcription,
            effective_note_type,
            structure_guidance,
            specific_instructions
        )
        
        # Estimate tokens
        transcription_tokens = self._estimate_tokens(transcription)
        prompt_tokens = self._estimate_tokens(prompt)
        system_prompt_tokens = self._estimate_tokens(system_prompt)
        total_input_tokens = prompt_tokens + system_prompt_tokens
        
        # Get model limits
        max_tokens = self._get_max_tokens_for_model(deployment_name)
        available_tokens = max_tokens - 2000  # Reserve for response
        
        # Determine if processing is needed
        needs_processing = total_input_tokens > available_tokens
        
        # Calculate processing recommendations
        processing_info = {}
        if needs_processing:
            # Estimate how much the transcription needs to be reduced
            reduction_needed = total_input_tokens - available_tokens
            target_transcription_tokens = transcription_tokens - reduction_needed
            target_transcription_chars = target_transcription_tokens * 4
            
            processing_info = {
                "needs_processing": True,
                "reduction_needed_tokens": reduction_needed,
                "target_transcription_length": target_transcription_chars,
                "estimated_chunks": max(1, math.ceil(transcription_tokens / (available_tokens * 0.6))),
                "recommended_workers": min(3, max(1, math.ceil(transcription_tokens / (available_tokens * 0.6))))
            }
        else:
            processing_info = {
                "needs_processing": False,
                "reduction_needed_tokens": 0,
                "target_transcription_length": len(transcription),
                "estimated_chunks": 1,
                "recommended_workers": 1
            }
        
        return {
            "token_estimates": {
                "transcription_tokens": transcription_tokens,
                "prompt_tokens": prompt_tokens,
                "system_prompt_tokens": system_prompt_tokens,
                "total_input_tokens": total_input_tokens,
                "model_max_tokens": max_tokens,
                "available_tokens": available_tokens
            },
            "processing_recommendations": processing_info,
            "model_info": {
                "deployment_name": deployment_name,
                "effective_note_type": effective_note_type,
                "template_type": "custom" if use_custom_template else "predefined"
            }
        }