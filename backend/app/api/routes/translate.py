from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.config import settings
from app.schemas.translation import (
    TranslationRequest,
    TranslationResponse,
    SupportedLanguagesResponse,
    LanguageItem,
    EngineItem
)
from app.services.translation_service import translation_manager, TranslationException

router = APIRouter(tags=["Translation"])

@router.post("/translate", response_model=TranslationResponse)
async def translate_transcript(payload: TranslationRequest):
    """
    Translates a completed transcription job into a target language using
    DeepL API (Free) or Meta NLLB-200 local fallback.
    """
    try:
        result = await translation_manager.translate_job(
            job_id=payload.job_id,
            target_lang_code=payload.target_language,
            preferred_engine=payload.engine or "auto"
        )
        return TranslationResponse(**result)
    except TranslationException as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal translation error: {exc}")

@router.get("/translate/languages", response_model=SupportedLanguagesResponse)
async def get_supported_languages():
    """
    Returns supported target languages and available translation engine statuses (including DeepL credit usage).
    """
    languages = [
        LanguageItem(code=code, name=meta["name"])
        for code, meta in settings.SUPPORTED_TRANSLATION_LANGUAGES.items()
    ]
    engines_data = await translation_manager.get_supported_engines()
    
    engines = [EngineItem(id="auto", name="Auto (Recommended)", status="available")]
    engines.extend([EngineItem(**e) for e in engines_data])

    return SupportedLanguagesResponse(
        languages=languages,
        engines=engines
    )
