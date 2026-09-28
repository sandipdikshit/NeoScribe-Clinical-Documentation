import datetime as dt
import logging
import os
import sys
import time
import requests
import json
from fastapi import UploadFile, HTTPException
from app.v1.services.blob_storage_handler import BlobServiceClient


# Set up the variables
SUBSCRIPTION_KEY = os.getenv("SPEECH_SUBSCRIPTION_KEY")
SERVICE_REGION = os.getenv("SPEECH_SERVICE_REGION")
RECORDINGS_BLOB_URI = os.getenv("SAS_URL")
NAME = "Simple transcription"
DESCRIPTION = "Simple transcription description"
LOCALE = "en-US"
MODEL_REFERENCE = None

# Verify that the subscription key and region are loaded correctly
if not SUBSCRIPTION_KEY or not SERVICE_REGION:
    logging.error(
        "Subscription key or service region not found in environment variables."
    )
    sys.exit(1)


# Validate the file type
def validate_file_type(file: UploadFile):
    """Validate the file type of the uploaded audio file.

    Args:
        file (UploadFile): File to validate.

    Raises:
        HTTPException: Invalid file type.
    """
    # Validate file type
    valid_mime_types = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/flac"]
    if file.content_type not in valid_mime_types:
        raise HTTPException(
            status_code=400, detail="Invalid file type. Only audio files are allowed."
        )


# Validate the file extension
def validate_file_extension(file: UploadFile):
    """Validate the file extension of the uploaded audio file.

    Args:
        file (UploadFile): File to validate.

    Raises:
        HTTPException: Invalid file extension.

    Returns:
        file_extention: Extention of the file.
    """
    # Validate file extension
    valid_extensions = [".mp3", ".wav", ".ogg", ".flac"]
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in valid_extensions:
        raise HTTPException(
            status_code=400,
            detail="Invalid file extension. Only audio files are allowed.",
        )
    return file_extension


# Generate a unique filename
def generate_unique_filename(file_extension: str) -> str:
    """Generates a unique filename for the uploaded audio file.

    Args:
        file_extension (str): Extention of the file.

    Returns:
        new_filename: Generated unique filename.
    """
    # Generate a unique filename
    new_file_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M%S")
    new_filename = f"{new_file_id}{file_extension}"
    return new_filename


# Create a transcription job
def create_transcription_job(subscription_key, region, sas_url, language, name):
    """Creates a transcription job for the uploaded audio file.

    Args:
        subscription_key (string): Subscription key for the Speech Service.
        region (string): Region for the Speech Service.
        sas_url (string): SAS url for the uploaded audio file.
        language (string): Language of the audio file.
        name (string): Name of the transcription job.

    Returns:
        success - JSON Object: Json object with the transcription job details.
        failed - None: None if the transcription job creation failed.
    """
    url = (
        f"https://{region}.api.cognitive.microsoft.com/speechtotext/v3.2/transcriptions"
    )

    headers = {
        "Ocp-Apim-Subscription-Key": subscription_key,
        "Content-Type": "application/json",
    }
    
    payload = {
        "contentUrls": [sas_url],
        "locale": language,
        "displayName": name,
        "model": None,
        "properties": {
            "wordLevelTimestampsEnabled": True,
            "languageIdentification": {"candidateLocales": ["en-US", "de-DE", "es-ES"]},
        },
    }

    logging.info("Sending transcription request...")
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 201:
        logging.info("Transcription request accepted.")
        return response.json()
    else:
        logging.error(
            f"Transcription request failed with status code {response.status_code}: {response.text}"
        )
        return None


# Get the transcription status
def get_transcription_status(subscription_key, transcription_url):
    """Get the status of the transcription job.

    Args:
        subscription_key (string): Subscription key for the Speech Service.
        transcription_url (string): Transcription URL.

    Returns:
        JSON Object: Response with the transcription job status.
    """

    headers = {"Ocp-Apim-Subscription-Key": subscription_key}
    logging.info("Checking transcription status...")
    response = requests.get(transcription_url, headers=headers)
    if response.status_code == 200:
        logging.info("Transcription status retrieved successfully.")
        return response.json()
    else:
        logging.error(
            f"Failed to get transcription status with status code {response.status_code}: {response.text}"
        )
        return None


# Get the transcription result
def get_transcription_result(subscription_key, transcription_url):
    """Get Transcription Results.

    Args:
        subscription_key (string): Subscription key for the Speech Service.
        transcription_url (string): Transcription URL.

    Returns:
        JSON Object: Response with the transcription job result.
    """
    headers = {"Ocp-Apim-Subscription-Key": subscription_key}
    logging.info("Retrieving transcription result...")
    response = requests.get(transcription_url, headers=headers)
    if response.status_code == 200:
        logging.info("Transcription result retrieved successfully.")
        return response.json()
    else:
        logging.error(
            f"Failed to get transcription result with status code {response.status_code}: {response.text}"
        )
        return None


# Get the transcript
def get_result(url):
    """Get Results for transcription job.

    Args:
        url (string): URL for the results.

    Returns:
        JSON Object: Response containing the transcription result.
    """
    logging.info(f"Fetching result")
    response = requests.get(url)
    if response.status_code == 200:
        logging.info("Result retrieved successfully.")
        return response.json()
    else:
        logging.error(
            f"Failed to get result with status code {response.status_code}: {response.text}"
        )
        return None


# Save to a JSON file
def save_json(transcription_result, file_path):
    """Save into a JSON file.

    Args:
        transcription_result (JSON Object): json object to save.
        file_path (string): Path to save the file.
    """
    try:
        with open(file_path, "w") as json_file:
            json.dump(transcription_result, json_file, indent=4)
        logging.info(f"Transcription result saved to {file_path}")
    except Exception as e:
        logging.error(f"Failed to save transcription result: {e}")


#!SECTION


# SECTION audioHandler/Main functions


# Save the audio file to Azure Blob Storage
async def upload_audio(file: UploadFile):
    """Save the uploaded audio file to Azure Blob Storage.

    Args:
        file (UploadFile): File to upload

    Returns:
        res: JSON response with the status of the upload.
    """
    # validate the file type and extension
    validate_file_type(file)
    file_extension = validate_file_extension(file)

    # Generate a unique filename
    new_filename = generate_unique_filename(file_extension)

    blob_service_client = BlobServiceClient()

    # Save the file to blob storage
    res = blob_service_client.upload_file(
        file=file, filename=new_filename, blob_name=new_filename
    )

    sas_url = blob_service_client.generate_sas_url(blob_name=new_filename)
    return {"message": res, "sas_url": sas_url}


# Transcribe the audio file
def transcribe_audio(sas_url):
    """Transcribe the given audio file.

    Args:
        sas_url (string): URL of the audio file in Azure Blob Storage.

    Returns:
        JSON Object: JSON object containing the transcription result.
    """
    logging.info("Starting transcription client...")
    transcription_job = create_transcription_job(
        subscription_key=SUBSCRIPTION_KEY,
        region=SERVICE_REGION,
        sas_url=sas_url,
        language=LOCALE,
        name=NAME,
    )
    if not transcription_job:
        logging.error("Failed to create transcription job.")
        return None

    done = False
    while not done:
        transcription_status = get_transcription_status(
            subscription_key=SUBSCRIPTION_KEY,
            transcription_url=transcription_job.get("self"),
        )
        if not transcription_status:
            logging.error("Failed to get transcription status.")
            return None
        status = transcription_status.get("status")
        logging.info(f"Transcription status: {status}")
        if status == "Succeeded":
            done = True
            job_result = get_transcription_result(
                subscription_key=SUBSCRIPTION_KEY,
                transcription_url=transcription_status.get("links").get("files"),
            )

            if not job_result:
                logging.error("Failed to get transcription result.")
                return None

            result_url = [
                item.get("links", {}).get("contentUrl")
                for item in job_result.get("values", [])
                if item.get("kind") == "Transcription"
                and item.get("links", {}).get("contentUrl")
            ]
        elif status == "Failed":
            result_url = None
            logging.error("Failed to get transcription result.")
            done = True
        elif status == "Running":
            time.sleep(5)
        else:
            logging.error("Unexpected transcription status.")
            done = True

    if result_url:
        results = get_result(result_url[0])
        if results:
            return results
        else:
            logging.error("Failed to fetch transcription result.")
    else:
        logging.error("No result URL found.")


#!SECTION
