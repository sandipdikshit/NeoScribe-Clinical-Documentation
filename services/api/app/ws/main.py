"""
This module initializes and runs the FastAPI application for the NeoScribe project.

It includes the main application setup and configuration.
"""

from dotenv import load_dotenv

load_dotenv()

import os
import uvicorn
from fastapi import FastAPI 
from app.ws.transcription.realtime_transcription import router as transcribe_router
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

origins = ["*"]

app.include_router(transcribe_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Get host and port from environment variables
host = os.getenv("APP_HOST", "127.0.0.1")  # Default to 127.0.0.1 if not specified
port = int(os.getenv("APP_PORT", 3000))  # Default to 3000 if not specified

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=host, port=5500, reload=True, reload_dirs=["app"])
