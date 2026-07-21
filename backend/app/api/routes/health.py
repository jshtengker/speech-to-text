from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.services.job_service import job_repo

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def health_check():
    """Returns system health, GPU availability, and active job count."""
    cuda_available = False
    try:
        import ctranslate2
        cuda_available = ctranslate2.get_cuda_device_count() > 0
    except Exception:
        pass

    return HealthResponse(
        status="ok",
        cuda_available=cuda_available,
        device="cuda" if cuda_available else "cpu",
        active_jobs=job_repo.get_active_job_count()
    )
