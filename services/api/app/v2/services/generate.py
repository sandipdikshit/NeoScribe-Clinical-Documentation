import json
import os
import logging
from typing import Dict, Any, Optional, List, Union
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
from dotenv import load_dotenv
from sqlalchemy import false, null

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
                 config_path: Optional[str] = None):
        """
        Initialize the note generator with Azure OpenAI credentials.
        
        Args:
            api_key: Azure OpenAI API key. If None, uses LLM_API_KEY from env.
            endpoint: Azure OpenAI endpoint. If None, uses LLM_API_URL from env.
            config_path: Path to the note types configuration JSON file.
        """
        self.api_key = api_key or os.getenv("LLM_API_KEY")
        self.endpoint = endpoint or os.getenv("LLM_API_URL")
        
        if not self.api_key or not self.endpoint:
            raise ValueError("Azure OpenAI credentials are required. Set environment variables or pass them to the constructor.")
        
        # Initialize Azure OpenAI client
        self.client = AzureOpenAI(
            api_key=self.api_key,
            api_version="2023-12-01-preview",
            azure_endpoint=self.endpoint
        )
        
        # Load note type configurations
        self.config_path = config_path or os.path.join(os.path.dirname(__file__), r'configs\note_config.json')
        print(f"config_path: {self.config_path}")
        self._load_note_configurations()
        
        logger.info(f"Initialized NoteGenerator with config from {self.config_path}")
    
    def _load_note_configurations(self):
        """Load note type configurations from the JSON file."""
        try:
            with open(self.config_path, 'r') as f:
                self.note_configurations = json.load(f)
                print(f"notes config: {self.note_configurations}")
                logger.info(f"Loaded {len(self.note_configurations.get('note_types', {}))} note type configurations")
        except FileNotFoundError:
            logger.warning(f"Configuration file {self.config_path} not found. Using default configurations.")
            self.note_configurations = {"note_types": {}}
        except json.JSONDecodeError:
            logger.error(f"Error parsing configuration file {self.config_path}. Using default configurations.")
            self.note_configurations = {"note_types": {}}
    
    def generate_medical_note(
        self, 
        healthcare_data: Dict[str, Any], 
        conversation_transcript: str, 
        note_type: str,
        deployment_name: str = "gpt-4o-mini"
    ) -> Dict[str, Any]:
        """
        Generate a structured medical note using Azure OpenAI's models.
        
        Args:
            healthcare_data: Dictionary containing structured healthcare data
            conversation_transcript: Transcript of clinician-patient conversation
            note_type: Type of medical note to generate (e.g. "SOAP Note")
            deployment_name: Name of the model deployment on Azure
            
        Returns:
            Dictionary containing structured note sections
        """
        # Extract relevant healthcare information
        extracted_data = self._extract_healthcare_information(healthcare_data)
        logger.info(f"Extracted healthcare data for {len(extracted_data['documents'])} documents")
        
        # Get structure guidance for the specified note type
        structure_guidance = self._get_note_structure_guidance(note_type)

        print(f"Note structure guidance: {structure_guidance}")
        
        # Prepare the prompt for Azure OpenAI
        prompt = self._create_prompt(extracted_data, conversation_transcript, note_type, structure_guidance)
        
        try:
            # Send request to Azure OpenAI
            logger.info(f"Generating {note_type} using {deployment_name} model")
            content_message = [
                    {"role": "system", "content": self._get_system_prompt(note_type)},
                    {"role": "user", "content": prompt}
                ]
            logger.info(f"Request length: {len(str(content_message))}")
            response = self.client.chat.completions.create(
                model=deployment_name,
                messages=content_message,
                temperature=0.1,  # Reduced temperature for more consistent output
                max_tokens=4000    # Increased token limit for more detailed notes
            )
            
            # Extract and process the response
            return self._process_response(response)
            
        except Exception as e:
            logger.error(f"Error generating medical note: {str(e)}")
            return {"error": str(e)}
    
    def _get_system_prompt(self, note_type: str) -> str:
        """
        Generate a detailed system prompt based on the note type.
        
        Args:
            note_type: Type of medical note to generate
            
        Returns:
            System prompt string
        """
        base_prompt = """You are an expert medical documentation specialist with extensive experience in clinical documentation.
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

DO NOT invent or assume information not present in the provided data.
"""
        
        # Look up note-type specific guidance from configuration
        note_type_key = note_type.lower().replace(" ", "_").replace("-", "_")
        note_types = self.note_configurations.get("note_types", {})
        
        # Try to find an exact match first
        if note_type_key in note_types:
            config = note_types[note_type_key]
            return base_prompt + config.get("system_prompt_addition", "")
            
        # If no exact match, try to find a partial match
        for config_key, config in note_types.items():
            if config_key in note_type_key:
                return base_prompt + config.get("system_prompt_addition", "")
                
        # For note types that don't match any configuration, fallback to default
        logger.warning(f"No specific configuration found for note type: {note_type}")
        return base_prompt
    
    def _process_response(self, response) -> Dict[str, Any]:
        """Process and extract JSON from LLM response."""
        try:
            # Extract the JSON from the response
            response_text = response.choices[0].message.content
            
            # Find JSON content within the response (in case there's additional text)
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                medical_note = json.loads(json_str)
                return medical_note
            else:
                # If no JSON found, return the raw text for debugging
                return {"error": "No valid JSON found in response", "raw_response": response_text}
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return {"error": f"Failed to parse JSON response: {e}", "raw_response": response_text}
    
    def _create_prompt(self, extracted_data: Dict[str, Any], conversation_transcript: str, 
                      note_type: str, structure_guidance: Dict[str, Any]) -> str:
        """Create a detailed prompt for the LLM to generate a comprehensive medical note."""
        prompt = f"""
        # TASK
        Generate a detailed, comprehensive {note_type} based on the provided healthcare data and conversation transcript.
        
        # NOTE TYPE INFORMATION
        This is a {structure_guidance["structure"]} that should follow standard medical documentation practices.
        
        # REQUIRED SECTIONS
        The note must include these sections based on the {note_type} format:
        {', '.join(structure_guidance["sections"])}
        
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
        - content: Detailed, comprehensive content for that section using proper medical formatting
        
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
        
        # IMPORTANT GUIDELINES
        - DO NOT INVENT information not present in the provided data
        - Include all relevant information from the data sources
        - Use specific medical terminology rather than general statements
        - Include appropriate level of detail for a professional medical note
        - Organize content logically within each section
        - Follow standard medical documentation practices for the specified note type
        - Ensure the note would be acceptable in a clinical setting by medical professionals
        """
        
        # Add note-type specific instructions from configuration
        note_type_key = note_type.lower().replace(" ", "_").replace("-", "_")
        note_types = self.note_configurations.get("note_types", {})
        
        # Try to find an exact match first
        if note_type_key in note_types:
            config = note_types[note_type_key]
            if "specific_instructions" in config:
                prompt += f"\n\n{config['specific_instructions']}"
        else:
            # If no exact match, try to find a partial match
            for config_key, config in note_types.items():
                if config_key in note_type_key and "specific_instructions" in config:
                    prompt += f"\n\n{config['specific_instructions']}"
                    break
        
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
        
        # Handle different possible input formats
        if isinstance(healthcare_data, str):
            try:
                data = json.loads(healthcare_data)
            except json.JSONDecodeError:
                logger.warning("Failed to parse healthcare data as JSON")
                return result
        else:
            data = healthcare_data
        
        # Extract document information
        if "documents" in data:
            for doc in data["documents"]:
                doc_info = {
                    "healthcare_relations": doc.get("healthcare_relations", []),
                    "key_phrases": doc.get("key_phrases", []),
                }
                result["documents"].append(doc_info)
        
        return result
    
    def _get_note_structure_guidance(self, note_type: str) -> Dict[str, Any]:
        """
        Get guidance on the structure and sections for different note types.
        
        Args:
            note_type: Type of medical note to generate
            
        Returns:
            Dictionary with note structure guidance and sections
        """
        note_type_key = note_type.lower().replace(" ", "_").replace("-", "_")
        note_types = self.note_configurations.get("note_types", {})

        print(f"Note type key: {note_type_key}")
        print(f"Note types: {note_types}")
        
        # Try to find an exact match first
        if note_type_key in note_types:
            config = note_types[note_type_key]
            return {
                "structure": config.get("structure", "General medical note structure"),
                "sections": config.get("sections", self._get_default_sections())
            }
            
        # If no exact match, try to find a partial match
        for config_key, config in note_types.items():
            if config_key in note_type_key:
                return {
                    "structure": config.get("structure", "General medical note structure"),
                    "sections": config.get("sections", self._get_default_sections())
                }
        
        # If no configuration is found, return default structure
        logger.warning(f"No structure guidance found for note type: {note_type}")
        return {
            "structure": "General medical note structure",
            "sections": self._get_default_sections()
        }
    
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
    
    def generate_note(
        self,
        analytics_data: Union[str, Dict[str, Any]],
        transcription: str,
        note_type: str = "SOAP Note",
        deployment_name: str = "gpt-4o-mini"
    ) -> Dict[str, Any]:
        """
        Main method to generate a medical note from analytics data and transcription.
        
        Args:
            analytics_data: Healthcare data from text analysis (JSON string or dict)
            transcription: Transcription of the conversation
            note_type: Type of note to generate
            deployment_name: Azure OpenAI model to use
            
        Returns:
            Dictionary containing the structured note
        """        
        # Process input data
        if isinstance(analytics_data, str):
            try:
                healthcare_data = json.loads(analytics_data)
            except json.JSONDecodeError:
                logger.error("Failed to parse analytics data as JSON")
                return {"error": "Invalid analytics data format"}
        else:
            healthcare_data = analytics_data
        
        logger.info(f"Generating {note_type} from transcription : {len(transcription)}, text analytics : {len(str(healthcare_data))} characters")

        # Generate the medical note
        result = self.generate_medical_note(
            healthcare_data=healthcare_data,
            conversation_transcript=transcription,
            note_type=note_type,
            deployment_name=deployment_name
        )
        
        return result
    
    def to_json(self, note_data: Dict[str, Any]) -> str:
        """
        Convert note data to formatted JSON.
        
        Args:
            note_data: The note data to convert
            
        Returns:
            Formatted JSON string
        """
        return json.dumps(note_data, indent=2)


if __name__ == "__main__":
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Example usage
    try:
        # Sample conversation transcript
        conversation_transcript = """Patient 1613 Psychotherapy progress note mental status exam. Orientation X3 oriented to person, place, and time. General appearance, Appropriate dress, Appropriate motor activity, Unremarkable interview behavior, Appropriate speech, Normal mood, Anxious effect, Appropriate insight, Good judgment. Impulse control, Good memory, Intact attention. Concentration. Good thought process, Unremarkable thought content, Appropriate perception, Unremarkable functional status, Intact risk assessment. Patient denies all areas of risk, no contrary clinical indications, present medications, subjective symptom description and subjective report. Client talked about the anxiety she has felt over the past week. Client talked about an issue with her mother. Client talked about her wedding planning interventions. Used active reflective listening, cognitive, challenging communication skills, Exploration of coping patterns. Exploration of emotions. Interpersonal resolutions. Mindfulness training, exploration of relationship patterns, Psychoeducation, self compassion, relaxation, deep breathing, role play, behavioral rehearsal, structured problem solving. Person centered treatment plan Progress primary goal, Manage anxiety progress, maintain secondary goal, Learn emotion, language and self-expression. Progress progressing tertiary goal. Create a support network. Progress Progressing assessment The client responded well to the session as evidenced by client report Diagnosis F 41.1 Generalized anxiety disorder plan recommendation Continue Current therapeutic focus Duration 53 minutes"""
        
        
        analytics_data = {}
        
        # Initialize note generator with config path
        note_generator = NoteGenerator()
        print(note_generator._get_note_structure_guidance("soap"))
        
        # Generate PROGRESS note
        # progress_note = note_generator.generate_note(
        #     analytics_data=analytics_data,
        #     transcription=conversation_transcript,
        #     note_type="PROGRESS"
        # )
        
        # # Print result
        # print(json.dumps(progress_note, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}")