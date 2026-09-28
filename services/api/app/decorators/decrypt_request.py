from functools import wraps
from fastapi import HTTPException
from pydantic import ValidationError
from typing import Type
import json

# Import your crypto service
from app.encryption.crypto_service import CryptoService

crypto_service = CryptoService()


def decrypt_request(model: Type):
    """
    Decorator for decrypting and validating request bodies into a Pydantic model.
    Usage:
        @decrypt_request(PatientUpdate)
        async def endpoint(request: Request, data: PatientUpdate, ...)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
                try:
                    request = kwargs.get('request') or args[0]
                    # Step 1: Read body
                    raw_body = await request.body()
                    body_dict = json.loads(raw_body.decode("utf-8"))

                    # Step 2: Decrypt if header is set
                    if request.headers.get("X-Encrypt-Request", "").lower() == "true":
                        body_dict = crypto_service.decrypt(body_dict)
                        print(f"Decrypted body: {body_dict}")
                    else:
                        pass

                    # Step 3: Parse into Pydantic model
                    parsed = model(**body_dict)
                    kwargs.pop('data', None)  # Remove data from kwargs if present

                except (json.JSONDecodeError, ValidationError, Exception) as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid or malformed request: {str(e)}"
                    )

                # Step 4: Inject model into endpoint as `data`
                kwargs["data"] = parsed
                return await func(*args, **kwargs)


        return wrapper
    return decorator
