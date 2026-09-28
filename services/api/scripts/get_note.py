import requests
from fastapi import HTTPException
import os
import dotenv
import time
dotenv.load_dotenv()

api_url = os.getenv("LLM_API_URL")
api_key = os.getenv("LLM_API_KEY")

def get_template(path):
    with open(path, "r", encoding="utf-8") as file:
        return file.read()
    
async def generate_soap_note(text):
    """
    Generate a SOAP note using a language model (LLM) via an API.

    Args:
        request (SOAPNoteRequest): The request body containing the text.

    Returns:
        SOAPNoteResponse: The generated SOAP note.
    """

    headers = {
        "Content-Type": "application/json",
        "api-key": str(api_key),
        "Authorization": f"Bearer {api_key}",
    }
    template = get_template("references/template.md")

    instructions = f"""
    You are an expert medical documentation specialist. Using the provided audio transcript, generate a detailed SOAP note following US healthcare documentation standards. Parse the clinical information and organize it into a clear, professional medical note.
    INPUT PROCESSING INSTRUCTIONS:
1. Analyze the audio transcript for:
   - Patient complaints and symptoms
   - Clinical findings and observations
   - Test results and measurements
   - Treatment decisions and recommendations
   - Follow-up plans and instructions

2. Extract and categorize information into the following components:
   - Patient demographic information
   - Chief complaints
   - Clinical history elements
   - Examination findings
   - Assessment details
   - Treatment plans

OUTPUT REQUIREMENTS:
Generate a comprehensive medical note in markdown format with the following structure:
    {template}
    FORMATTING REQUIREMENTS:
- Use clear hierarchical markdown formatting
- Maintain professional medical terminology
- Include relevant dates and times
- Quantify measurements and findings
- Use appropriate medical abbreviations
- Ensure sections are clearly delineated
- If a section is not applicable, indicate "N/A" or "Not Known"

SPECIFIC GUIDELINES:
1. Maintain logical flow of information
2. Include pertinent positive and negative findings
3. Use objective language
4. Avoid redundancy
5. Ensure completeness of documentation
6. Support medical necessity
7. Enable appropriate coding/billing
8. Facilitate continuity of care
9. Provided template is a guideline; adjust as needed
Note: Ensure all generated content maintains patient privacy and follows HIPAA guidelines. The note should support clinical decision-making while meeting documentation requirements for US healthcare systems.
    """

    prompt = f"""Transcript{text}"""

    payload = {
        "messages": [
            {"role": "system", "content": instructions},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "top_p": 0.95,
    }

    try:
        response = requests.post(api_url, json=payload, headers=headers)
        response.raise_for_status()  # Raises HTTPError for bad responses (4xx, 5xx)

        return response.json()

    except requests.exceptions.HTTPError as http_err:
        # Handle HTTP errors (4xx, 5xx)
        try:
            error_detail = response.json()
            error_message = error_detail.get("error", {}).get("message", str(http_err))
        except ValueError:
            error_message = response.text or str(http_err)

        print(
            f"HTTP Error occurred: Status Code: {response.status_code}, Error: {error_message}"
        )
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Failed to generate SOAP note: {error_message}",
        )

    except requests.exceptions.RequestException as err:
        # Handle other requests-related errors (connection, timeout, etc.)
        print(f"Request failed: {str(err)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate SOAP note: {str(err)}"
        )


if __name__ == "__main__":

    import markdown2
    import pdfkit
    import sys
    import asyncio

    async def convert_md_to_pdf(markdown_content, pdf_file_path):

        # Convert Markdown to HTML
        html_content = markdown2.markdown(markdown_content)

        # Convert HTML to PDF
        pdfkit.from_string(html_content, pdf_file_path)

    def save_as_markdown(content: str, file_path: str):
        with open(file_path, "w", encoding="utf-8") as file:
            file.write(content)
        print(f"Saved Markdown file: {file_path}")

    async def main():
        
        for index in range(1, 2):
            print(f"Processing note {index}")
            file_path = f"D:\\Work root\\Neoscribe\\neoscribe_backend\\Data\\Transcripts\\{index}.txt"
            with open(file_path, "r", encoding="utf-8") as file:
                note_content = file.read()
            note_response = await generate_soap_note(note_content)
            soap_note_content = note_response["choices"][0]["message"]["content"]
            save_as_markdown(soap_note_content, f"Data/testdata/{index}/Note.md")
            await convert_md_to_pdf(soap_note_content, f"Data/testdata/{index}/Note.pdf")
            print(f"Completed note {index}")
            print("Waiting 10 seconds")
            time.sleep(20)

        # file_path = f"D:\\Work root\\Neoscribe\\neoscribe_backend\\Data\\Transcripts\\15.txt"
        # with open(file_path, "r", encoding="utf-8") as file:
        #     note_content = file.read()
        # note_response = await generate_soap_note(note_content)
        # soap_note_content = note_response["choices"][0]["message"]["content"]
        # await convert_md_to_pdf(soap_note_content, f"Data/Notes/output15.pdf")


    asyncio.run(main())