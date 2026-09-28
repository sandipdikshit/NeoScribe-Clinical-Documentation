from functools import wraps
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import logging

# Import crypto service
from app.encryption.crypto_service import CryptoService

crypto_service = CryptoService()
logger = logging.getLogger(__name__)


def encrypt_response(func):
    """
    Decorator for encrypting JSON responses if 'X-Encrypt-Response: true' is set in the request.
    Works with endpoints that return dicts or JSONResponse-compatible objects.
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        response_data = await func(*args, **kwargs)

        try:
            # Convert to JSON-serializable structure
            serializable = jsonable_encoder(response_data)

            # Encrypt the JSON response
            encrypted_response = crypto_service.encrypt(serializable)

            return JSONResponse(
                content=encrypted_response,
                status_code=200,
                media_type="application/json"
            )

        except Exception as e:
                logger.error(f"Response encryption failed: {str(e)}", exc_info=True)
                return JSONResponse(
                    content={"detail": "Response encryption failed."},
                    status_code=500
                )

    return wrapper
