from fastapi import APIRouter
from app.core.config import settings
from app.schemas.model import ModelListResponse, ModelInfo

router = APIRouter(tags=["Models"])

@router.get("/models", response_model=ModelListResponse)
def get_supported_models():
    """Returns list of supported Whisper AI models with metadata and specs."""
    model_list = [
        ModelInfo(id=key, **value) for key, value in settings.SUPPORTED_MODELS.items()
    ]
    return ModelListResponse(models=model_list)
