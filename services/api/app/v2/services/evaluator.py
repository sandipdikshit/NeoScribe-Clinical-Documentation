import os
import dotenv
from pprint import pprint
from langchain_openai import AzureChatOpenAI
from langchain.evaluation.qa import QAEvalChain
from langchain.evaluation.criteria import CriteriaEvalChain, LabeledCriteriaEvalChain

dotenv.load_dotenv()

# === Setup Azure Chat LLM ===
llm = AzureChatOpenAI(
    azure_endpoint=os.getenv("LLM_API_ENDPOINT"),
    api_key=os.getenv("LLM_API_KEY"),
    api_version=os.getenv("LLM_API_VERSION", "2025-01-01-preview"),
    deployment_name="gpt-4o-mini",
)

# === Scoring Utilities ===
def normalize(score, multiplier=100):
    try:
        return round(float(score) * multiplier, 2)
    except Exception:
        return 0.0

# === Main Evaluation ===
def evaluate_note(generated_note: str, transcript: str) -> dict:
    # === Documentation & Transcription Evaluation ===
    qa_eval = QAEvalChain.from_llm(llm)
    qa_score = qa_eval.evaluate(
        examples=[{"query": "Summarize the following transcript", "answer": transcript}],
        predictions=[{"result": generated_note}]
    )[0].get("predicted_score", 1.0)

    coverage_chain = CriteriaEvalChain.from_llm(llm, criteria={
        "coverage": "Does the generated note adequately cover all the key points from the transcript?"
    })
    coverage_result = coverage_chain.evaluate_strings(
        prediction=generated_note,
        input="Summarize the following transcript"
    )
    coverage_score = normalize(coverage_result.get("score", 1.0))

    doc_score = round((normalize(qa_score) + coverage_score) / 2, 2)

    # === Coding & Billing Relevance ===
    entity_chain = LabeledCriteriaEvalChain.from_llm(llm, criteria="relevance")
    entity_score = entity_chain.evaluate_strings(
        prediction=generated_note,
        reference=transcript,
        label=transcript,
        input="Summarize the following transcript"
    )
    entity_score = normalize(entity_score.get("score", 1.0))

    coding_score = entity_score

    # === Quality & Consistency ===
    fluency_chain = CriteriaEvalChain.from_llm(llm, criteria="conciseness")
    fluency_score = fluency_chain.evaluate_strings(
        prediction=generated_note,
        input="Evaluate the note for fluency and conciseness"
    )
    fluency_score = normalize(fluency_score.get("score", 1.0))

    # Use LabeledCriteriaEvalChain for correctness (plausibility)
    plausibility_chain = LabeledCriteriaEvalChain.from_llm(llm, criteria="correctness")
    plausibility_score = plausibility_chain.evaluate_strings(
        prediction=generated_note,
        reference=transcript,  # <-- REQUIRED
        label=transcript,
        input="Summarize the following transcript"
    )
    plausibility_score = normalize(plausibility_score.get("score", 1.0))

    quality_score = round((fluency_score + plausibility_score) / 2, 2)

    # === Final Aggregation ===
    overall_score = round((doc_score + coding_score + quality_score) / 3, 2)

    # Determine flag and routing decision based on overall score
    def score_to_flag(score: float):
        if score < 33:
            return "red", "Redictation"
        elif score < 66:
            return "yellow", "Review"
        else:
            return "green", "Approve"

    flag, routing = score_to_flag(overall_score)

    results = {
        "category_scores": {
            "Documentation & Transcription": doc_score,
            "Coding & Billing Relevance": coding_score,
            "Quality & Consistency": quality_score,
        },
        "overall_score": overall_score,
        "flag": flag,
        "routing_decision": routing,
        "detailed_metrics": {
            "qa_score": normalize(qa_score),
            "context_coverage": coverage_score,
            "clinical_entity_accuracy": entity_score,
            "fluency": fluency_score,
            "medical_plausibility": plausibility_score,
        }
    }
    print("Evaluation Results:")
    pprint(results)

    return results

# === Run Example ===
if __name__ == "__main__":
    generated_note = (
        "CC: Follow-up for anxiety and relationship difficulties.\n"
        "HPI: Patient is a 68-year-old white male presenting for follow-up regarding ongoing anxiety symptoms, "
        "first noted approximately 3+ months ago after retirement. Primary concern centers around relational distress with his wife. "
        "Reports increased anxiety during a recent family vacation due to emotional disconnection. Anxiety levels average 6–7/10, peaking at 8/10. "
        "Experiences hypervigilance, catastrophizing, sleep disruption (4–5 hrs/night), and reassurance-seeking behaviors. "
        "Acknowledges insight into relational patterns and post-retirement adjustment.\n"
        "Medications: Sertraline 50mg daily. No current side effects. Patient is adherent.\n"
        "Psychosocial: Relationship strain is the primary anxiety trigger. Patient identifies communication difficulties, feels emotionally neglected, "
        "and is concerned about long-term relationship stability. Demonstrates self-awareness and willingness to improve.\n"
        "ROS: Negative for fever, chills, cough, chest pain, or GI symptoms. No weight change. Reports mild fatigue due to insomnia.\n"
        "Assessment: Adjustment Disorder with Anxiety (F43.22) – chronic course triggered by life transition and relational strain.\n"
        "Plan:\n"
        "- Continue sertraline 50mg daily.\n"
        "- Revisit sleep hygiene and consider intervention if insomnia persists.\n"
        "- Refer to couples counseling.\n"
        "- Reinforce CBT techniques (journaling, cognitive restructuring).\n"
        "- Encourage non-relationship outlets for emotional fulfillment (new hobbies, activities).\n"
        "- Follow-up in 4 weeks."
    )
    transcript = (
        "Doctor: Good afternoon. Please come in and have a seat. What brings you back into the clinic today?\n",
        "Patient: Hi, Doctor. I'm here for my follow-up appointment. I've been having some ongoing issues with anxiety, especially around my relationship with my wife.\n",
        "Doctor: I see. Let me pull up your chart. Your current diagnosis is adjustment disorder with anxiety. How long have you been experiencing these symptoms now?\n",
        "Patient: It's been about three months since we first talked about this. Maybe a little longer.\n",
        "Doctor: Let's talk about your anxiety symptoms first.\n",
        "Patient: yes, Sure.\n",
        "Doctor: On a scale of 1 to 10, how would you rate your anxiety levels over the past two weeks?\n",
        "Patient: Most days it's around a 6 or 7. Sometimes it spikes to an 8 when I'm having relationship issues with my wife.\n",
        "Doctor: Are you still taking the sertraline I prescribed three months ago?\n",
        "Patient: Yes, I take it every morning. 50 milligrams.\n",
        "Doctor: Good. Any side effects from the medication?\n",
        "Patient: Not really. Maybe some mild nausea the first few weeks, but that went away.\n",
        "Doctor: Are you sleeping through the night?\n",
        "Patient: When I'm anxious about things with my wife, I tend to lie awake ruminating about our arguments.\n",
        "Doctor: How many hours of sleep are you getting on average?\n",
        "Patient: Maybe 4 or 5 hours.\n",
        "Doctor: That's concerning. Are you experiencing any physical symptoms - racing heart, sweating, trembling?\n",
        "Patient: Sometimes.\n",
        "Doctor: Do you find yourself seeking reassurance from your wife or others?\n",
        "Patient: Yes, I often ask her if she still loves me or if we're going to be okay.\n",
        "Doctor: I understand. It sounds like your anxiety is closely tied to your relationship with your wife. Can you tell me more about what's been going on?\n",
        "Patient: Well, since I retired, I've been feeling a bit lost. My wife and I have been arguing more, and I feel like she's emotionally distant.\n",
        "Doctor: That must be difficult. Have you noticed any patterns in your arguments?\n",
        "Patient: Yes, it seems like we argue about the same things over and over. I feel like I'm not being heard, and she feels like I'm being too needy.\n",
        "Doctor: It sounds like there's a communication breakdown. Have you both considered couples counseling?\n",
        "Patient: We haven't yet, but I think it might help. I just want to feel connected again.\n",
    )
    transcript = "".join(transcript)
    result = evaluate_note(generated_note, transcript)
    pprint(result.get("routing_decision", "No routing decision found"))