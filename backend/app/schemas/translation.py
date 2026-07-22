from typing import List, Optional
from pydantic import BaseModel
from app.schemas.segment import SegmentItem

class TranslationRequest(BaseModel):
    job_id: str
    target_language: str
    engine: Optional[str] = "auto"

class TranslationResponse(BaseModel):
    job_id: str
    target_language: str
    target_language_name: str
    engine_selected: str
    engine_used: str
    segments: List[SegmentItem]

class LanguageItem(BaseModel):
    code: str
    name: str

class DeepLUsageInfo(BaseModel):
    character_count: int
    character_limit: int
    remaining_characters: int
    percent_remaining: float

class EngineItem(BaseModel):
    id: str
    name: str
    status: str
    usage: Optional[DeepLUsageInfo] = None

class SupportedLanguagesResponse(BaseModel):
    languages: List[LanguageItem]
    engines: List[EngineItem]

