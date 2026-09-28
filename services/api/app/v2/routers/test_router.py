from fastapi import Form
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
import os
import logging
from dotenv import load_dotenv
load_dotenv()

endpoint = os.getenv("AZURE_LANGUAGE_ENDPOINT")
key = os.getenv("AZURE_LANGUAGE_KEY")

router = APIRouter()

router.get("/test")
async def test_endpoint():
    """
    Test endpoint to verify the API is working.
    
    Returns:
        JSONResponse: A simple message indicating the API is working.
    """
    logging.info("Test endpoint hit")
    return JSONResponse(content={"message": "API is working!"})
