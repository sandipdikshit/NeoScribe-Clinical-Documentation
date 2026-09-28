import requests
from fastapi import HTTPException
import os


api_url = os.getenv("LLM_API_URL")
api_key = os.getenv("LLM_API_KEY")


async def generate_soap_note(text):
    """Generates a SOAP note using the GenAI API.

    Args:
        text (string): Text to generate SOAP note from.

    Raises:
        HTTPException: If an error occurs during the request.

    Returns:
        JSON Object: The generated SOAP note.
    """    
    headers = {
        "Content-Type": "application/json",
        "api-key": str(api_key),
        "Authorization": f"Bearer {api_key}",
    }

    prompt = f"""Generate a soap note containing subheadings subjective, objective, assessment and plan for the following text, : 
        "{text}"
      the output should contain only the soap note and should be contained within 200 words."""

    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 500,
        "temperature": 0.9,
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
