"""
This module defines the admin API V2 router for the NeoScribe application.

"""

import os
from fastapi import APIRouter
from app.database import test_database_connection
from app.middlewares.response_formatter import format_response

#routes
from app.v2.routers.admin.patient import router as patient_router
from app.v2.routers.admin.note import router as note_router
from app.v2.routers.admin.template import router as template_router
from app.v2.routers.admin.feedback import router as feedback_router
# from app.v2.routers.admin.audit_log import router as audit_log_router
from app.v2.routers.admin.sections import router as section_router
from app.v2.routers.admin.provider import router as provider_router

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

# Include all admin routers
router.include_router(patient_router)
router.include_router(note_router)
router.include_router(template_router)
router.include_router(feedback_router)
# router.include_router(audit_log_router)
router.include_router(section_router)
router.include_router(provider_router)

@router.get("/admin")
def root():
    """ 
    Root endpoint of the NeoScribe application.

    Returns:
        dict: A welcome message.
    """
    server = "True" if True else "False" 
    database = "True" if test_database_connection() else "False"

    response = format_response(
        message="Welcome to the NeoScribe admin app!!!",
        status_code=200,
        data={
            "Server Running": server,
            "Database Connection": database
        }
    )

    return response