# ! this file needs to be worked on

import logging
import sys
import os
import time
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# Set up logging
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s : %(message)s",
    datefmt="%m/%d/%Y %I:%M:%S %p %Z",
)

# Set up the subscription info for the Speech Service:
SUBSCRIPTION_KEY = os.getenv("SPEECH_SUBSCRIPTION_KEY")
SERVICE_REGION = os.getenv("SPEECH_SERVICE_REGION")
RECORDINGS_BLOB_URI = os.getenv("SAS_URL")

# Verify that the subscription key and region are loaded correctly
if not SUBSCRIPTION_KEY or not SERVICE_REGION:
    logging.error(
        "Subscription key or service region not found in environment variables."
    )
    sys.exit(1)

# Set up the transcription settings
NAME = "Simple transcription"
DESCRIPTION = "Simple transcription description"
LOCALE = "en-US"
MODEL_REFERENCE = None

#Create a transcription job
def create_transcription_job(subscription_key, region, sas_url, language, name):
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


def save_json(transcription_result, file_path):

    try:
        with open(file_path, "w") as json_file:
            json.dump(transcription_result, json_file, indent=4)
        logging.info(f"Transcription result saved to {file_path}")
    except Exception as e:
        logging.error(f"Failed to save transcription result: {e}")


def transcribe(sas_url):
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


# Example usage
if __name__ == "__main__":
    transcript = transcribe(RECORDINGS_BLOB_URI)
    save_json(transcript, "transcript.json")
