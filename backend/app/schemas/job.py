from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class DownloadUrls(BaseModel):
    txt: str
    srt: str

class JobSubmitResponse(BaseModel):
    job_id: str
    filename: str
    model: str
    status: str
    message: str
    segments: Optional[List[Dict[str, Any]]] = None
    downloads: Optional[DownloadUrls] = None


class JobStatusResponse(BaseModel):
    job_id: str
    filename: str
    model: str
    status: str
    created_at: float
    completed_at: Optional[float] = None
    execution_time: Optional[float] = None
    language: Optional[str] = None
    language_probability: Optional[float] = None
    total_segments: int = 0
    error: Optional[str] = None
    downloads: DownloadUrls

class JobCancelResponse(BaseModel):
    message: str
    job_id: Optional[str] = None
    status: str
