from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.v2.models.audit_log import AuditLogCRUD
import json
from jose import jwt
import os
import dotenv
dotenv.load_dotenv()

class AuditLogMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        exclude_paths: set = None,
        exclude_methods: set = None
    ):
        super().__init__(app)
        self.exclude_paths = exclude_paths or {
            "/docs",
            "/redoc",
            "/openapi.json",
            "/audit-logs",
        }
        self.exclude_methods = exclude_methods or {"GET", "HEAD", "OPTIONS"}

    def extract_provider_id_from_token(self, request: Request) -> int | None:
        """Extract provider ID from JWT token in Authorization header."""
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return None
            print (f"Authorization header: {auth_header}")
            token = auth_header.split(" ")[1]
            payload = jwt.decode(
                token,
                os.getenv("JWT_SECRET_KEY"),
                algorithms=[os.getenv("JWT_ALGORITHM")]
            )
            return payload.get("id")
        except Exception as e:
            print(f"Error extracting provider ID from token: {str(e)}")
            return None

    def extract_resource_from_path(self, path: str) -> tuple[str | None, str | None]:
        """Extract resource type and ID from URL path."""
        try:
            # Remove leading and trailing slashes and split
            path_parts = path.strip("/").split("/")
            
            # Check if path follows the pattern /api/v2/{resource}/{id?}
            if len(path_parts) >= 3 and path_parts[0] == "api" and path_parts[1] == "v2":
                resource_type = path_parts[2].upper()
                resource = path_parts[3] if len(path_parts) > 3 else None
                return resource_type, resource
        except Exception as e:
            print(f"Error extracting resource from path: {str(e)}")
        
        return None, None

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip logging for excluded paths and methods
        if (
            request.url.path in self.exclude_paths or
            request.method in self.exclude_methods
        ):
            return await call_next(request)

        # Get request details
        path = request.url.path
        method = request.method
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        # Extract resource type and ID from path
        resource_type, resource = self.extract_resource_from_path(path)

        # Map HTTP methods to actions
        action_map = {
            "POST": "CREATE",
            "PUT": "UPDATE",
            "PATCH": "UPDATE",
            "DELETE": "DELETE"
        }
        action = action_map.get(method)

        # Get request body if available
        details = None
        if method in {"POST", "PUT", "PATCH"}:
            try:
                body = await request.body()
                if body:
                    details = json.loads(body)
            except:
                pass

        # Get provider ID from JWT token
        provider_id = self.extract_provider_id_from_token(request)

        # Create audit log entry
        try:
            db = SessionLocal()
            crud = AuditLogCRUD(db)
            crud.create_log(
                path=path,
                action=action,
                resource_type=resource_type,
                provider_id=provider_id,
                resource=resource,
                details=details,
                ip_address=ip_address,
                user_agent=user_agent
            )
            print(f"Audit log created: {action} {resource_type} {resource} by provider {provider_id}")
        except Exception as e:
            print(f"Error creating audit log: {str(e)}")
        finally:
            db.close()

        # Process the request
        response = await call_next(request)
        return response