from typing import Optional
from pydantic import BaseModel, Field

# pydantic schemas
class EncryptedRequest(BaseModel):
    """Base model for encrypted requests"""
    encryptedText: str = Field(..., description="Encrypted data in base64 format")
    iv: str = Field(..., description="Initialization vector in base64 format")
    authTag: Optional[str] = Field(None, description="Authentication tag in base64 format")

class EncryptedResponse(BaseModel):
    """Base model for encrypted responses"""
    encryptedText: str = Field(..., description="Encrypted data in base64 format")
    iv: str = Field(..., description="Initialization vector in base64 format")
    authTag: Optional[str] = Field(None, description="Authentication tag in base64 format")