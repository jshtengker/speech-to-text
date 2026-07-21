from typing import List, Optional
from pydantic import BaseModel

class ModelInfo(BaseModel):
    id: str
    name: str
    vram: str
    description: str
    default: bool

class ModelListResponse(BaseModel):
    models: List[ModelInfo]
