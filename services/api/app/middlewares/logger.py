from fastapi import Request
import time
from typing import Callable
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Custom middleware to log requests and responses
async def log_requests(request: Request, call_next: Callable):
    # Log request
    start_time = time.time()
    
    logger.info(f"""
    Request:
        URL: {request.url}
        Method: {request.method}
        Headers: {request.headers}
        Client: {request.client}
    """)
    
    # Process request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    
    # Log response
    logger.info(f"""
    Response:
        Status: {response.status_code}
        Processing Time: {process_time:.4f} seconds
        Headers: {response.headers}
    """)
    
    return response