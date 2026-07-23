from fastapi import APIRouter
from app.core.config import settings
from app.schemas.model import ModelListResponse, ModelInfo
from app.services.groq_service import groq_service

router = APIRouter(tags=["Models"])

@router.get("/models", response_model=ModelListResponse)
def get_supported_models():
    """Returns list of supported Whisper AI models based on environment configuration."""
    model_list = [
        ModelInfo(id=key, **value) for key, value in settings.SUPPORTED_MODELS.items()
    ]
    return ModelListResponse(
        models=model_list,
        groq_configured=groq_service.is_configured(),
        enable_local_models=settings.ENABLE_LOCAL_MODELS
    )
