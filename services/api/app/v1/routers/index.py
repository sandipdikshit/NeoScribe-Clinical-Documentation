"""
This module defines the main API router for the NeoScribe application.

It includes routes for user and organization management.
"""

from fastapi import APIRouter
from app.database import test_database_connection

#routes
from app.v1.routers.user import router as user_router
from app.v1.routers.org import router as org_router
from app.v1.routers.app_routes import router as application_router # *Done
from app.v1.routers.patient import router as patient_router
from app.v1.routers.transcript import router as transcript_router


router = APIRouter()

router.include_router(user_router, prefix="/users")
router.include_router(org_router, prefix="/orgs")
router.include_router(application_router, prefix="/app")
router.include_router(patient_router, prefix="/patients")
router.include_router(transcript_router, prefix="/transcripts")


@router.get("/")
def root():
    """
    Root endpoint of the NeoScribe application.

    Returns:
        dict: A welcome message.
    """
    server = "True" if True else "False" 
    database = "True" if test_database_connection() else "False"

    return {"message": "Welcome to the NeoScribe app!!!", "Server Running": server, "Database Connection": database}