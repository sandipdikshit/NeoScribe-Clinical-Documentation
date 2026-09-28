from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from fastapi import Request
import json
import logging

logger = logging.getLogger(__name__)

class EncryptionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle request decryption and response encryption
    based on custom headers:
      - X-Encrypt-Request: true
      - X-Encrypt-Response: true
    """
    def __init__(self, app, crypto_service):
        super().__init__(app)
        self.crypto_service = crypto_service

    async def dispatch(self, request: Request, call_next):
        # 🟡 Decrypt incoming request if needed
        if request.headers.get("X-Encrypt-Request", "").lower() == "true":
            try:
                # Read and decrypt request body
                body_bytes = await request.body()
                body_str = body_bytes.decode("utf-8")
                encrypted_payload = json.loads(body_str)

                print(f"Decrypting incoming request: {encrypted_payload}")

                decrypted_data = self.crypto_service.decrypt(encrypted_payload)
                new_body_bytes = json.dumps(decrypted_data).encode("utf-8")


                print(f"Decrypted request data: {new_body_bytes}, ")

                async def receive():
                    return {
                        "type": "http.request",
                        "body": new_body_bytes,
                        "more_body": False
                    }
                request = Request(request.scope, receive=receive())
                print(f"Replaced request body with decrypted data.")

            except Exception as e:
                print(f"Request decryption failed: {str(e)}", exc_info=True)
                return Response(
                    content=f"Request decryption failed: {str(e)}",
                    status_code=400
                )
        print('made it to the request handler', request.method, request.url, request.body)
        # 🟢 Proceed to the route handler
        response = await call_next(request)

        # 🟡 Encrypt outgoing response if needed
        if request.headers.get("X-Encrypt-Response", "").lower() == "true":
            try:
                # Read original response body
                response_body = b""
                async for chunk in response.body_iterator:
                    response_body += chunk

                # Encrypt the response JSON
                response_json = json.loads(response_body.decode("utf-8"))
                logger.debug(f"Original response JSON: {response_json}")
                encrypted_response = self.crypto_service.encrypt(response_json)

                encrypted_body = json.dumps(encrypted_response).encode("utf-8")
                logger.debug(f"Encrypting outgoing response: {encrypted_response}")

                # Clean headers and remaove Content-Length
                new_headers = dict(response.headers)
                new_headers.pop("content-length", None)  # Remove old Content-Length

                # Return new encrypted response
                return Response(
                    content=encrypted_body,
                    status_code=response.status_code,
                    headers=new_headers,
                    media_type="application/json"
                )

            except Exception as e:
                logger.error(f"Response encryption failed: {str(e)}", exc_info=True)
                return Response(
                    content=f"Response encryption failed: {str(e)}",
                    status_code=500
            )
        return response
