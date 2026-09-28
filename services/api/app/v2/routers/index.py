"""
This module defines the main API V2 router for the NeoScribe application.

It includes routes for user and organization management.
"""

import os
from fastapi import APIRouter, HTTPException, status
from app.database import test_database_connection
from app.middlewares.response_formatter import format_response
import logging
from typing import Dict, Any

#routes
from app.v2.routers.provider import router as user_router
from app.v2.routers.patient import router as patient_router
from app.v2.routers.health import router as health_router
from app.v2.routers.note import router as note_router
from app.v2.routers.sections import router as section_router
from app.v2.routers.transcribe import router as transcribe_router
from app.v2.routers.feedback import router as feedback_router
from app.v2.routers.template import router as template_router
from app.v2.routers.audit_log import router as audit_log_router
from app.v2.routers.uploadApi import router as upload_router
from app.helper_functions.poetry_version import get_project_version

router = APIRouter()

logger = logging.getLogger(__name__)

def validate_and_include_routers() -> None:
    """
    Validates that all required routers are available and includes them.
    
    Raises:
        RuntimeError: If any required router is None or fails to include.
    """
    required_routers = {
        "user_router": user_router,
        "patient_router": patient_router,
        "note_router": note_router,
        "section_router": section_router,
        "transcribe_router": transcribe_router,
        "feedback_router": feedback_router,
        "template_router": template_router,
        "audit_log_router": audit_log_router,
        "upload_router": upload_router,
        "health_router": health_router,
    }
    
    # Check if all required routers are available
    missing_routers = [name for name, router in required_routers.items() if router is None]
    
    if missing_routers:
        error_msg = f"Failed to initialize NeoScribe API V2 Router: Missing routers: {', '.join(missing_routers)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)
    
    # Include all routers
    try:
        router.include_router(user_router)
        router.include_router(patient_router)
        router.include_router(note_router)
        router.include_router(section_router)
        router.include_router(transcribe_router)
        router.include_router(feedback_router)
        router.include_router(template_router)
        router.include_router(audit_log_router)
        router.include_router(upload_router)
        router.include_router(health_router)
        
        logger.info("Successfully initialized NeoScribe API V2 Router")
        
    except Exception as e:
        error_msg = f"Failed to include routers: {str(e)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)

# Initialize routers with proper error handling
try:
    validate_and_include_routers()
except RuntimeError as e:
    logger.critical(f"Critical error during router initialization: {e}")
    # In a production environment, you might want to exit here
    # import sys
    # sys.exit(1)

@router.get("/")
def root():
    """ 
    Root endpoint of the NeoScribe application.

    Returns:
        dict: A welcome message with server and database status.
        
    Raises:
        HTTPException: If there's an error checking system status.
    """
    try:
        # Check server status (always True for now, but could be enhanced)
        server_status = True
        
        # Check database connection with proper error handling
        try:
            database_status = test_database_connection()
        except Exception as db_error:
            logger.error(f"Database connection test failed: {str(db_error)}")
            database_status = False
        
        # Prepare status data
        status_data = {
            "Server Running": str(server_status),
            "Database Connection": str(database_status)
        }
        
        # Determine appropriate status code and message
        if not database_status:
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            message = "Welcome to the NeoScribe app! (Database connection unavailable)"
        else:
            status_code = status.HTTP_200_OK
            message = "Welcome to the NeoScribe app!!!"
        
        response = format_response(
            message=message,
            status_code=status_code,
            data=status_data
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error in root endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred while checking system status"
        )

@router.get("/version")
def app_version():
    """
    Endpoint to get the version of the NeoScribe application.

    Returns:
        dict: A dictionary containing the version information.
        
    Raises:
        HTTPException: If there's an error retrieving version information.
    """
    try:
        # Get project version with proper error handling
        try:
            version = get_project_version()
            version_info = f"{version} (alpha)"
        except FileNotFoundError:
            logger.warning("pyproject.toml not found, using fallback version")
            version_info = "unknown (alpha)"
        except Exception as version_error:
            logger.error(f"Error retrieving project version: {str(version_error)}")
            version_info = "error (alpha)"
        
        response = format_response(
            message="Neoscribe Version",
            status_code=status.HTTP_200_OK,
            data={
                "version": version_info
            }
        )
        return response
        
    except Exception as e:
        logger.error(f"Error in version endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred while retrieving version information"
        )

@router.get("/health")
def health_check():
    """
    Comprehensive health check endpoint for the NeoScribe application.
    
    Returns:
        dict: Health status of various system components.
        
    Raises:
        HTTPException: If there's an error during health check.
    """
    try:
        health_data = {}
        overall_status = "healthy"
        
        # Check database connection
        try:
            db_healthy = test_database_connection()
            health_data["database"] = {
                "status": "healthy" if db_healthy else "unhealthy",
                "message": "Database connection successful" if db_healthy else "Database connection failed"
            }
            if not db_healthy:
                overall_status = "degraded"
        except Exception as db_error:
            logger.error(f"Database health check failed: {str(db_error)}")
            health_data["database"] = {
                "status": "error",
                "message": f"Database health check error: {str(db_error)}"
            }
            overall_status = "degraded"
        
        # Check version information
        try:
            version = get_project_version()
            health_data["version"] = {
                "status": "healthy",
                "version": version,
                "message": "Version information retrieved successfully"
            }
        except Exception as version_error:
            logger.error(f"Version health check failed: {str(version_error)}")
            health_data["version"] = {
                "status": "error",
                "message": f"Version check error: {str(version_error)}"
            }
            overall_status = "degraded"
        
        # Check environment
        health_data["environment"] = {
            "status": "healthy",
            "env": os.getenv("ENV", "unknown"),
            "message": "Environment configuration loaded"
        }
        
        # Determine status code based on overall health
        if overall_status == "healthy":
            status_code = status.HTTP_200_OK
        elif overall_status == "degraded":
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        else:
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        
        response = format_response(
            message=f"NeoScribe Health Check - Status: {overall_status}",
            status_code=status_code,
            data={
                "overall_status": overall_status,
                "components": health_data
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error in health check endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred during health check"
        ) 
