import os
from pathlib import Path
from typing import Dict, Any, List

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

class Settings:
    PROJECT_NAME: str = "Speech-to-Text API"
    DESCRIPTION: str = "FastAPI backend for local Whisper Speech-to-Text transcription with real-time SSE streaming."
    VERSION: str = "1.0.0"

    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOADS_DIR: Path = BASE_DIR / "uploads"
    OUTPUTS_DIR: Path = BASE_DIR / "outputs"

    CORS_ORIGINS: List[str] = ["*"]

    MAX_UPLOAD_SIZE_BYTES: int = 2 * 1024 * 1024 * 1024
    ALLOWED_EXTENSIONS: set = {
        ".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".opus", ".wma",
        ".mp4", ".mkv", ".mov", ".webm", ".avi", ".flv"
    }

    SUPPORTED_MODELS: Dict[str, Dict[str, Any]] = {
        "turbo": {"name": "Turbo", "vram": "~1.8 GB", "description": "Fast & high precision (Recommended)", "default": True},
        "large-v3": {"name": "Large v3", "vram": "~3.0 GB", "description": "Maximum accuracy for accents & technical terms", "default": False},
        "medium": {"name": "Medium", "vram": "~1.5 GB", "description": "High precision, balanced for CPU & GPU", "default": False},
        "small": {"name": "Small", "vram": "~0.8 GB", "description": "Moderate speed and low resource usage", "default": False},
        "base": {"name": "Base", "vram": "~0.4 GB", "description": "Fast draft quality", "default": False},
        "tiny": {"name": "Tiny", "vram": "~0.2 GB", "description": "Ultra fast / minimal RAM & CPU load", "default": False},
    }

    DEEPL_API_KEY: str = os.getenv("DEEPL_API_KEY", "")
    DEFAULT_TRANSLATION_ENGINE: str = os.getenv("DEFAULT_TRANSLATION_ENGINE", "auto")

    SUPPORTED_TRANSLATION_LANGUAGES: Dict[str, Dict[str, str]] = {
        "EN": {"name": "English", "deepl": "EN", "nllb": "eng_Latn"},
        "ES": {"name": "Spanish", "deepl": "ES", "nllb": "spa_Latn"},
        "ID": {"name": "Indonesian", "deepl": "ID", "nllb": "ind_Latn"},
        "JA": {"name": "Japanese", "deepl": "JA", "nllb": "jpn_Jpan"},
        "DE": {"name": "German", "deepl": "DE", "nllb": "deu_Latn"},
        "FR": {"name": "French", "deepl": "FR", "nllb": "fra_Latn"},
        "ZH": {"name": "Chinese", "deepl": "ZH", "nllb": "zho_Hans"},
        "KO": {"name": "Korean", "deepl": "KO", "nllb": "kor_Hang"},
        "PT": {"name": "Portuguese", "deepl": "PT-PT", "nllb": "por_Latn"},
        "IT": {"name": "Italian", "deepl": "IT", "nllb": "ita_Latn"},
        "RU": {"name": "Russian", "deepl": "RU", "nllb": "rus_Cyrl"},
        "NL": {"name": "Dutch", "deepl": "NL", "nllb": "nld_Latn"},
        "AR": {"name": "Arabic", "deepl": "AR", "nllb": "arb_Arab"},
    }

    def __init__(self):
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        self.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()

