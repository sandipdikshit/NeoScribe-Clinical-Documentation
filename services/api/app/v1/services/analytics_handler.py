import json
import os
from azure.ai.textanalytics import TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential

AZURE_LANGUAGE_ENDPOINT = os.getenv("AZURE_LANGUAGE_ENDPOINT")
AZURE_LANGUAGE_KEY = os.getenv("AZURE_LANGUAGE_KEY")


class Result:
    def __init__(
        self,
        document_id,
        text,
        healthcare_entities,
        entity_relations,
        sentiment_analysis,
        key_phrases,
        abstract_summary,
        extracted_summary,
    ):
        self.document_id = document_id
        self.text = text
        self.healthcare_entities = healthcare_entities
        self.entity_relations = entity_relations
        self.sentiment_analysis = sentiment_analysis
        self.key_phrases = key_phrases
        self.abstract_summary = abstract_summary
        self.extracted_summary = extracted_summary

    def to_dict(self):
        return {
            "document_id": self.document_id,
            "text": self.text,
            "healthcare_entities": self.healthcare_entities,
            "entity_relations": self.entity_relations,
            "sentiment_analysis": self.sentiment_analysis,
            "key_phrases": self.key_phrases,
            "abstract_summary": self.abstract_summary,
            "extracted_summary": self.extracted_summary,
        }


# SECTION - Helper Functions


def authenticate_text_client():
    # Replace with your Azure resource details

    ta_credential = AzureKeyCredential(AZURE_LANGUAGE_KEY)
    text_analytics_client = TextAnalyticsClient(
        endpoint=AZURE_LANGUAGE_ENDPOINT, credential=ta_credential
    )
    return text_analytics_client


def export_json(data, path):
    with open(path, "w") as f:
        f.write(json.dumps(data, indent=4))


#!SECTION


# SECTION - Main Functions


# Perform analysis and generate output
def analyze_document(documents):
    client = authenticate_text_client()

    healthcare_poller = client.begin_analyze_healthcare_entities(documents=documents)
    sentiment_response = client.analyze_sentiment(documents=documents)
    key_phrases_response = client.extract_key_phrases(documents=documents)
    abstractive_summaries_poller = client.begin_abstract_summary(documents)
    extractive_summaries_poller = client.begin_extract_summary(documents)

    healthcare_results = healthcare_poller.result()
    abstractive_summaries = list(abstractive_summaries_poller.result())
    extractive_summaries = list(extractive_summaries_poller.result())

    results = []

    for idx, healthcare_result in enumerate(healthcare_results):
        healthcare_entities = []
        entity_relations = []
        sentiment_analysis = {}
        key_phrases = key_phrases_response[idx].key_phrases
        abstract_summary = [
            summary.text for summary in abstractive_summaries[idx].summaries
        ]
        extracted_summary = [
            sentence.text for sentence in extractive_summaries[idx].sentences
        ]

        if healthcare_result.is_error:
            healthcare_entities.append({"error": healthcare_result.error})
        else:
            healthcare_entities = [
                {
                    "text": entity.text,
                    "category": entity.category,
                    "subcategory": entity.subcategory,
                    "confidence_score": entity.confidence_score,
                    "data_sources": (
                        [ds.name for ds in entity.data_sources]
                        if entity.data_sources
                        else None
                    ),
                }
                for entity in healthcare_result.entities
            ]

            entity_relations = [
                {
                    "relation_type": relation.relation_type,
                    "entities": [
                        {"entity": role.entity.text, "role": role.name}
                        for role in relation.roles
                    ],
                }
                for relation in healthcare_result.entity_relations
            ]

        sentiment_result = sentiment_response[idx]
        sentiment_analysis = {
            "sentiment": sentiment_result.sentiment,
            "confidence_scores": {
                "positive": sentiment_result.confidence_scores.positive,
                "neutral": sentiment_result.confidence_scores.neutral,
                "negative": sentiment_result.confidence_scores.negative,
            },
        }

        result = Result(
            document_id=idx + 1,
            text=documents[idx],
            healthcare_entities=healthcare_entities,
            entity_relations=entity_relations,
            sentiment_analysis=sentiment_analysis,
            key_phrases=key_phrases,
            abstract_summary=abstract_summary,
            extracted_summary=extracted_summary,
        )

        results.append(result)

    return results


#!SECTION


if __name__ == "__main__":
    client = authenticate_text_client()

    # List of document
    document = [
        "Chief complaint atypical chest pain. History the patient is a 74-year-old Caucasian female patient of the physician who presented to the emergency room with atypical chest pain {period} She saw her hand orthopedist, the physician because of right wrist pain and was given meloxicam on the MM, DD {period} She also is aware of having hiatal hernia and having GERD, which was controlled on ranitidine {period} She started taking meloxicam five days ago and had taken once daily for the past five days and had been experiencing this discomfort on her lower sternum that she described it like tightness and this had prompted her to come to the emergency room {period} Her workup showed slightly elevated troponin of 0.45 and EKG showing nonspecific ST wave changes {period} She seems to have been feeling better and her pain had been slowly subsiding {period} She is comfortable resting in the gurney, but due to the slightly elevated troponin that she is being admitted for to rule out possibility of having acute coronary syndrome. Past medical history is significant for having one episode of high blood pressure most likely due to stress after having ERCP, but not on any medication. History of ulcerative colitis. History of osteoarthritis and osteoporosis. History of melanoma and basal cell cancer. History of hypercholesterolemia. History of breast cancer. History of sleep apnea. Past surgical history is status post laparoscopic cholecystectomy, status post parathyroidectomy, status post cataract surgery, status post bilateral knee arthroscopic surgery, status post total knee replacement, status post abdominal hysterectomy, status post mastectomy, status post lower back surgery. Social history she had been married and living with her husband and a known smoker. Denies drinking any alcohol. Allergies she is unable to tolerate statin and penicillin and Diovan. List of medications includes Prozac 20 mg once daily, meloxicam 15 mg once daily, Zantac 150 mg twice daily and Ambien 10 mg at bedtime and Norco 7.5/325 mg as needed. Physical exam, she is awake, alert, comfortable, resting in the gurney, in no cardiorespiratory distress. Blood pressure 150/70, heart rate in the 60s, respirations 18. HEENT anicteric sclerae. Pink conjunctivae. Clear nasal cavity and oropharynx. Neck is supple. No mass. Lungs sound clear to auscultation bilateral with unlabored breathing. Heart sound regular rhythm. No murmur. Extremity no edema. No cyanosis. Labs showed troponin of 0.45. White blood cell of 8.8, H and H of 14 and 43 with a platelet count of 229,000. Liver enzymes are unremarkable. Sodium 139, potassium 4, creatinine 0.63 with a glucose of 93. Chest x-ray is unremarkable with hiatal hernia. EKG shows normal sinus rhythm with a heart rate of 67 and a first-degree AV block. Assessment and plan atypical chest pain, needing to rule out acute coronary syndrome. Patient is now being admitted for serial troponin and CK-MB and if the trend is going up then might need cardiology consult versus Lexiscan. Assessment and plan number two hiatal hernia with GERD, which I suspect is what is causing more of her symptoms. We will give her Protonix 40 mg IV once daily. Assessment and plan number three osteoarthritis and depression. Continuing with her Norco and Prozac and we will inform her regular primary care, the physician, to follow up in the morning. Oh addendum to the past medical history also with history of depression and possible chronic recurrent UTI since she had been on Prozac and Macrobid. End of report."
    ]

    # Analyze Document
    print(analyze_document(document))
