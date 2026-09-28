import json
import logging
import os
from typing import List, Dict, Any, Optional, Union
from azure.core.credentials import AzureKeyCredential
from azure.ai.textanalytics import (
    TextAnalyticsClient,
    AnalyzeHealthcareEntitiesAction,
    RecognizePiiEntitiesAction,
    AnalyzeSentimentAction,
    ExtractKeyPhrasesAction,
    RecognizeEntitiesAction,
)
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MedicalTextAnalyzer:
    """
    Class for analyzing medical text using Azure Text Analytics.
    Extracts healthcare entities, relationships, sentiment, key phrases, and other insights.
    """
    
    def __init__(self, endpoint: Optional[str] = None, key: Optional[str] = None):
        """
        Initialize the analyzer with Azure Text Analytics credentials.
        
        Args:
            endpoint: Azure Text Analytics endpoint. If None, uses AZURE_LANGUAGE_ENDPOINT from env.
            key: Azure Text Analytics key. If None, uses AZURE_LANGUAGE_KEY from env.
        """
        self.endpoint = endpoint or os.getenv("AZURE_LANGUAGE_ENDPOINT")
        self.key = key or os.getenv("AZURE_LANGUAGE_KEY")
        
        if not self.endpoint or not self.key:
            raise ValueError("Azure Text Analytics credentials are required. Set environment variables or pass them to the constructor.")
        
        # Initialize Text Analytics client
        self.client = TextAnalyticsClient(
            endpoint=self.endpoint,
            credential=AzureKeyCredential(self.key)
        )
        
        logger.info("Initialized MedicalTextAnalyzer")
    
    def analyze_document(
        self,
        text: Union[str, List[str]],
        include_sentiment: bool = True,
        include_key_phrases: bool = True,
        include_entities: bool = True,
        include_pii: bool = True,
        domain_filter: str = "phi"
    ) -> Dict[str, Any]:
        """
        Analyze medical document with various text analytics capabilities.
        
        Args:
            text: Single document or list of documents to analyze
            include_sentiment: Include sentiment analysis
            include_key_phrases: Include key phrase extraction
            include_entities: Include entity recognition
            include_pii: Include PII detection
            domain_filter: Domain filter for PII (default: "phi")
            
        Returns:
            Dictionary with analysis results
        """
        # Ensure text is a list
        documents = [text] if isinstance(text, str) else text
        
        # Prepare actions list (always include healthcare entities)
        actions = [AnalyzeHealthcareEntitiesAction()]
        
        # Add optional actions based on parameters
        if include_sentiment:
            actions.append(AnalyzeSentimentAction())
        
        if include_key_phrases:
            actions.append(ExtractKeyPhrasesAction())
        
        if include_entities:
            actions.append(RecognizeEntitiesAction())
        
        if include_pii:
            actions.append(RecognizePiiEntitiesAction(domain_filter=domain_filter))
        
        # Log the analysis request
        logger.info(f"Analyzing {len(documents)} documents with {len(actions)} actions")
        
        try:
            # Submit the analysis request
            poller = self.client.begin_analyze_actions(
                documents,
                display_name="Medical Document Analysis",
                actions=actions,
            )
            
            # Process and structure the results
            result = self._process_results(documents, poller.result())
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing documents: {str(e)}")
            return {"error": str(e)}
    
    def _process_results(self, documents: List[str], document_results) -> Dict[str, Any]:
        """
        Process and structure the results from Azure Text Analytics.
        
        Args:
            documents: List of original documents
            document_results: Results from Azure Text Analytics
            
        Returns:
            Dictionary with structured results
        """
        # Initialize result structure
        result = {
            "documents": []
        }
        
        # Process results for each document
        for i, (doc, action_results) in enumerate(zip(documents, document_results)):
            document_analysis = {
                "id": str(i),
                "text": doc,
                "healthcare_entities": [],
                "healthcare_relations": [],
                "sentiment": {},
                "key_phrases": [],
                "entities": [],
                "pii_entities": [],
                "errors": []
            }
            
            # Process each action result
            for action_result in action_results:
                if action_result.is_error:
                    document_analysis["errors"].append({
                        "action": action_result.kind,
                        "code": action_result.error.code,
                        "message": action_result.error.message
                    })
                    continue
                    
                # Process healthcare entities and relations
                if action_result.kind == "Healthcare":
                    document_analysis = self._process_healthcare_results(document_analysis, action_result)
                
                # Process sentiment analysis
                elif action_result.kind == "SentimentAnalysis":
                    document_analysis = self._process_sentiment_results(document_analysis, action_result)
                
                # Process key phrases
                elif action_result.kind == "KeyPhraseExtraction":
                    document_analysis["key_phrases"] = action_result.key_phrases
                
                # Process general entities
                elif action_result.kind == "EntityRecognition":
                    document_analysis = self._process_entity_results(document_analysis, action_result)
                
                # Process PII entities
                elif action_result.kind == "PiiEntityRecognition":
                    document_analysis = self._process_pii_results(document_analysis, action_result)
            
            # Add document analysis to result
            result["documents"].append(document_analysis)
        
        return result
    
    def _process_healthcare_results(self, document_analysis: Dict[str, Any], action_result) -> Dict[str, Any]:
        """Process healthcare entities and relations."""
        # Process healthcare entities
        for entity in action_result.entities:
            entity_obj = {
                "text": entity.text,
                "normalized_text": entity.normalized_text,
                "category": entity.category,
                "subcategory": entity.subcategory,
                "offset": entity.offset,
                "length": len(entity.text),
                "confidence_score": entity.confidence_score,
                "is_negated": entity.assertion.association == "Subject" if entity.assertion else False,
                "data_sources": [],
                "assertion": {}
            }
            
            # Add data sources if available
            if entity.data_sources:
                for data_source in entity.data_sources:
                    entity_obj["data_sources"].append({
                        "entity_id": data_source.entity_id,
                        "name": data_source.name
                    })
            
            # Add assertion information if available
            if entity.assertion:
                entity_obj["assertion"] = {
                    "conditionality": entity.assertion.conditionality,
                    "certainty": entity.assertion.certainty,
                    "association": entity.assertion.association
                }
            
            document_analysis["healthcare_entities"].append(entity_obj)
        
        # Process healthcare entity relations
        for relation in action_result.entity_relations:
            relation_obj = {
                "relation_type": relation.relation_type,
                "roles": []
            }
            
            for role in relation.roles:
                relation_obj["roles"].append({
                    "name": role.name,
                    "entity": {
                        "text": role.entity.text,
                        "category": role.entity.category,
                        "subcategory": role.entity.subcategory
                    }
                })
            
            document_analysis["healthcare_relations"].append(relation_obj)
        
        return document_analysis
    
    def _process_sentiment_results(self, document_analysis: Dict[str, Any], action_result) -> Dict[str, Any]:
        """Process sentiment analysis results."""
        document_analysis["sentiment"] = {
            "sentiment": action_result.sentiment,
            "confidence_scores": {
                "positive": action_result.confidence_scores.positive,
                "neutral": action_result.confidence_scores.neutral,
                "negative": action_result.confidence_scores.negative
            },
            "sentences": []
        }
        
        for sentence in action_result.sentences:
            document_analysis["sentiment"]["sentences"].append({
                "text": sentence.text,
                "sentiment": sentence.sentiment,
                "confidence_scores": {
                    "positive": sentence.confidence_scores.positive,
                    "neutral": sentence.confidence_scores.neutral,
                    "negative": sentence.confidence_scores.negative
                },
                "offset": sentence.offset,
                "length": len(sentence.text)
            })
        
        return document_analysis
    
    def _process_entity_results(self, document_analysis: Dict[str, Any], action_result) -> Dict[str, Any]:
        """Process entity recognition results."""
        for entity in action_result.entities:
            document_analysis["entities"].append({
                "text": entity.text,
                "category": entity.category,
                "subcategory": entity.subcategory,
                "offset": entity.offset,
                "length": len(entity.text),
                "confidence_score": entity.confidence_score
            })
        
        return document_analysis
    
    def _process_pii_results(self, document_analysis: Dict[str, Any], action_result) -> Dict[str, Any]:
        """Process PII entity recognition results."""
        for entity in action_result.entities:
            document_analysis["pii_entities"].append({
                "text": entity.text,
                "category": entity.category,
                "subcategory": entity.subcategory,
                "offset": entity.offset,
                "length": len(entity.text),
                "confidence_score": entity.confidence_score,
                "redacted_text": entity.redacted_text if hasattr(entity, "redacted_text") else None
            })
        
        return document_analysis
    
    def analyze_transcription(self, transcription: str) -> Dict[str, Any]:
        """
        Analyze a medical transcription with all available capabilities.
        
        Args:
            transcription: The transcription text to analyze
            
        Returns:
            Dictionary with analysis results
        """
        logger.info(f"Analyzing transcription with {len(transcription)} characters")
        
        # For very long transcriptions, split into chunks if needed
        if len(transcription) > 5000:
            return self._analyze_long_transcription(transcription)
        
        # For shorter transcriptions, analyze directly
        return self.analyze_document(transcription)
    
    def _analyze_long_transcription(self, transcription: str) -> Dict[str, Any]:
        """
        Split and analyze long transcriptions in chunks.
        
        Args:
            transcription: The long transcription text
            
        Returns:
            Dictionary with combined analysis results
        """
        # Split by sentences or paragraphs
        chunks = self._split_into_chunks(transcription)
        
        # Analyze each chunk
        result = self.analyze_document(chunks)
        
        # Add original full text
        result["original_text"] = transcription
        result["chunks_count"] = len(chunks)
        
        return result
    
    def _split_into_chunks(self, text: str, max_chunk_size: int = 4500) -> List[str]:
        """
        Split text into appropriate chunks for analysis, preserving context.
        
        Args:
            text: The text to split
            max_chunk_size: Maximum size of each chunk
            
        Returns:
            List of text chunks
        """
        chunks = []
        # Try to split by paragraphs
        paragraphs = [p for p in text.split("\n") if p.strip()]
        
        current_chunk = ""
        for paragraph in paragraphs:
            # If adding this paragraph would exceed the chunk size, start a new chunk
            if len(current_chunk) + len(paragraph) + 1 > max_chunk_size:
                if current_chunk:
                    chunks.append(current_chunk)
                
                # If the paragraph itself is too long, split it by sentences
                if len(paragraph) > max_chunk_size:
                    sentences = self._split_into_sentences(paragraph)
                    sentence_chunks = []
                    current_sentence_chunk = ""
                    
                    for sentence in sentences:
                        if len(current_sentence_chunk) + len(sentence) + 1 > max_chunk_size:
                            if current_sentence_chunk:
                                sentence_chunks.append(current_sentence_chunk)
                            current_sentence_chunk = sentence
                        else:
                            if current_sentence_chunk:
                                current_sentence_chunk += " "
                            current_sentence_chunk += sentence
                    
                    if current_sentence_chunk:
                        sentence_chunks.append(current_sentence_chunk)
                    
                    chunks.extend(sentence_chunks)
                    current_chunk = ""
                else:
                    current_chunk = paragraph
            else:
                if current_chunk:
                    current_chunk += "\n"
                current_chunk += paragraph
        
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences.
        
        Args:
            text: The text to split
            
        Returns:
            List of sentences
        """
        # Simple sentence splitting - this could be improved with NLP
        sentence_endings = ['. ', '! ', '? ', '.\n', '!\n', '?\n']
        text_with_markers = text
        
        for ending in sentence_endings:
            text_with_markers = text_with_markers.replace(ending, ending + "[SPLIT]")
        
        sentences = [s.strip() for s in text_with_markers.split("[SPLIT]") if s.strip()]
        return sentences
    
    def to_json(self, result: Dict[str, Any]) -> str:
        """
        Convert analysis results to a formatted JSON string.
        
        Args:
            result: The analysis results dictionary
            
        Returns:
            Formatted JSON string
        """
        return json.dumps(result, indent=2)

# Legacy function for backward compatibility
def analyze_medical_document(documents: List[str], endpoint: str, key: str, **kwargs) -> Dict[str, Any]:
    """
    Legacy function for backward compatibility. Use MedicalTextAnalyzer class instead.
    
    Args:
        documents: List of text documents to analyze
        endpoint: Azure Text Analytics endpoint URL
        key: Azure Text Analytics API key
        **kwargs: Additional arguments for analysis
        
    Returns:
        Dict containing the analysis results
    """
    analyzer = MedicalTextAnalyzer(endpoint=endpoint, key=key)
    
    # Combine all documents into one, or use the first document if there's only one
    if len(documents) == 1:
        return analyzer.analyze_document(documents[0], **kwargs)
    else:
        combined_text = " ".join(documents)
        return analyzer.analyze_document(combined_text, **kwargs)


# Legacy function for backward compatibility
def analyze_medical_documents_to_json(documents: List[str], endpoint: str, key: str, **kwargs) -> str:
    """
    Legacy function for backward compatibility. Use MedicalTextAnalyzer.to_json() instead.
    
    Args:
        documents: List of text documents to analyze
        endpoint: Azure Text Analytics endpoint URL
        key: Azure Text Analytics API key
        **kwargs: Additional arguments for analysis
        
    Returns:
        JSON string containing the analysis results
    """
    result = analyze_medical_document(documents, endpoint, key, **kwargs)
    return json.dumps(result, indent=2)


if __name__ == "__main__":
    # Example usage
    try:
        # Sample medical text
        sample_text = """
        Patient presents with shortness of breath, chest pain, and fatigue lasting for the past 3 days.
        No history of cardiac issues, but has type 2 diabetes diagnosed 5 years ago.
        Vitals: BP 138/85, HR 92, Temp 37.2°C.
        Lab results show elevated troponin levels. ECG shows ST elevation in leads V2-V4.
        Diagnosis: Suspected myocardial infarction. 
        Plan: Admit to cardiac unit, start aspirin and heparin, schedule cardiac catheterization.
        """
        
        # Initialize analyzer
        analyzer = MedicalTextAnalyzer()
        
        # Analyze the text
        result = analyzer.analyze_transcription(sample_text)
        
        # Convert to JSON
        json_result = analyzer.to_json(result)
        
        # Print result
        print(json_result)
        
    except Exception as e:
        print(f"Error: {str(e)}")