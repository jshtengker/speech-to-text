from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class ModelInfo(BaseModel):
    id: str
    name: str
    vram: str
    description: str
    default: bool
    is_cloud: Optional[bool] = False

class ModelListResponse(BaseModel):
    models: List[ModelInfo]
    groq_configured: Optional[bool] = False
    enable_local_models: Optional[bool] = True
