from fastapi import APIRouter, Depends
from app.decorators.encrypt_response import encrypt_response
from app.v2.models.provider import (
    ProviderModel,
    ProviderResponse
)
from app.v2.auth import get_current_provider

router = APIRouter(
    prefix="/providers",
    tags=["providers"]
)

@router.get("/me", 
    summary="Get current provider profile",
    response_model=ProviderResponse)
@encrypt_response
async def read_provider_me(
    current_provider: ProviderModel = Depends(get_current_provider)
):
    """
    Get the profile of the currently authenticated provider
    """
    return current_provider