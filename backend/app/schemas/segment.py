from typing import List
from pydantic import BaseModel

class SegmentItem(BaseModel):
    index: int
    start: float
    end: float
    text: str

class SegmentPaginatedResponse(BaseModel):
    job_id: str
    page: int
    limit: int
    total_items: int
    total_pages: int
    segments: List[SegmentItem]
