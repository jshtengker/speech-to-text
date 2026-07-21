from fastapi import APIRouter
from app.api.routes.health import router as health_router
from app.api.routes.models import router as models_router
from app.api.routes.transcribe import router as transcribe_router
from app.api.routes.download import router as download_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(models_router)
api_router.include_router(transcribe_router)
api_router.include_router(download_router)
