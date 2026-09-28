import logging
from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Return a lightweight liveness response without external dependencies."""
    logger.debug("Health endpoint called")
    return {"status": "ok"}
