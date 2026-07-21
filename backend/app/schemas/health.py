from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    cuda_available: bool
    device: str
    active_jobs: int
