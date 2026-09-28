"""
This module initializes and runs the FastAPI application for the NeoScribe project.

It includes the main application setup and configuration.
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from app.v2.routers.index import router as main_router_v2
from app.v2.routers.admin.index import router as admin_router_v2
from app.ws.transcription.realtime_transcription import router as transcribe_router
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import HTTPException, RequestValidationError
from app.middlewares.logger import log_requests
from app.middlewares.audit_logger import AuditLogMiddleware
from app.telemetry.instrumentation import instrument_app
from app.middlewares.response_formatter import format_response, global_exception_handler
from app.encryption.crypto_service import CryptoService

load_dotenv()

app = FastAPI(title="NeoScribe API", version="2.1.3")
crypto_service = CryptoService()

# Register global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return global_exception_handler(request, exc)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return global_exception_handler(request, exc)

@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    return global_exception_handler(request, exc)

monitoring_enabled = os.getenv("MONITORING_ENABLED", "false").strip().lower() in {
    "1",
    "true",
    "yes",
}

if monitoring_enabled:
    instrument_app(
        app=app,
        service_name="neoscribe",
        otlp_endpoint=os.getenv("OTLP_ENDPOINT"),  # SigNoz endpoint
    )

if os.getenv("ENV"):
    print(f'Running on {os.getenv("ENV")}')

origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.include_router(main_router_v2, prefix="/api/v2")
app.include_router(admin_router_v2, prefix="/api")
app.include_router(transcribe_router, prefix="/socket")

app.middleware("http")(log_requests)
app.add_middleware(AuditLogMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Get host and port from environment variables
host = os.getenv("APP_HOST", "127.0.0.1")  # Default to 127.0.0.1 if not specified
port = int(os.getenv("APP_PORT", 5000))

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=host, port=port, reload=True, reload_dirs=["app"])
