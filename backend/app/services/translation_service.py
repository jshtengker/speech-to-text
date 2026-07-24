import os
import json
import logging
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod

import httpx
from app.core.config import settings
from app.services.job_service import job_repo
from app.utils.formatters import format_timestamp

logger = logging.getLogger(__name__)

class TranslationException(Exception):
    """Base exception for translation errors."""
    pass

class QuotaExceededException(TranslationException):
    """Raised when an API provider quota or rate limit is reached."""
    pass

class BaseTranslationProvider(ABC):
    id: str
    name: str

    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    async def translate(
        self,
        texts: List[str],
        source_lang: Optional[str],
        target_lang_code: str
    ) -> List[str]:
        pass

class DeepLTranslationProvider(BaseTranslationProvider):
    id = "deepl"
    name = "DeepL API Free"

    def is_configured(self) -> bool:
        return bool(settings.DEEPL_API_KEY and settings.DEEPL_API_KEY.strip())

    async def translate(
        self,
        texts: List[str],
        source_lang: Optional[str],
        target_lang_code: str
    ) -> List[str]:
        if not self.is_configured():
            raise TranslationException("DeepL API Key is missing.")

        lang_meta = settings.SUPPORTED_TRANSLATION_LANGUAGES.get(target_lang_code.upper())
        if not lang_meta or "deepl" not in lang_meta:
            raise TranslationException(f"Target language '{target_lang_code}' is not supported by DeepL.")

        deepl_target = lang_meta["deepl"]

        api_key = settings.DEEPL_API_KEY.strip()
        endpoint = (
            "https://api-free.deepl.com/v2/translate"
            if api_key.endswith(":fx")
            else "https://api.deepl.com/v2/translate"
        )

        headers = {
            "Authorization": f"DeepL-Auth-Key {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "text": texts,
            "target_lang": deepl_target,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(endpoint, json=payload, headers=headers)
                if response.status_code == 456:
                    raise QuotaExceededException("DeepL monthly quota limit reached (456).")
                elif response.status_code != 200:
                    raise TranslationException(f"DeepL API returned HTTP {response.status_code}: {response.text}")

                data = response.json()
                translations = [item["text"] for item in data.get("translations", [])]
                if len(translations) != len(texts):
                    raise TranslationException("DeepL returned mismatched translation item count.")
                return translations
            except httpx.RequestError as exc:
                raise TranslationException(f"DeepL network request failed: {exc}")

    async def get_usage(self) -> Optional[Dict[str, Any]]:
        if not self.is_configured():
            return None

        api_key = settings.DEEPL_API_KEY.strip()
        endpoint = (
            "https://api-free.deepl.com/v2/usage"
            if api_key.endswith(":fx")
            else "https://api.deepl.com/v2/usage"
        )
        headers = {
            "Authorization": f"DeepL-Auth-Key {api_key}",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(endpoint, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    count = data.get("character_count", 0)
                    limit = data.get("character_limit", 500000)
                    remaining = max(0, limit - count)
                    percent = round((remaining / limit) * 100, 1) if limit > 0 else 0.0
                    return {
                        "character_count": count,
                        "character_limit": limit,
                        "remaining_characters": remaining,
                        "percent_remaining": percent
                    }
            except Exception as e:
                logger.warning(f"Failed to fetch DeepL usage: {e}")
        return None

class MetaNLLBTranslationProvider(BaseTranslationProvider):
    id = "nllb"
    name = "Meta NLLB-200 (Local GPU/CPU)"

    def __init__(self):
        self._tokenizer = None
        self._model = None
        self._device = None
        self._lock = asyncio.Lock()

    def is_configured(self) -> bool:
        return settings.ENABLE_LOCAL_MODELS

    def _load_model_sync(self):
        if self._model is not None and self._tokenizer is not None:
            return

        import torch
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

        model_name = "facebook/nllb-200-distilled-600M"
        logger.info(f"Loading local HuggingFace translation model: {model_name}...")

        device_str = "cuda" if torch.cuda.is_available() else "cpu"
        self._device = device_str

        os.environ["HF_HUB_DISABLE_XET"] = "1"
        os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"
        os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

        self._tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            src_lang="eng_Latn",
            trust_remote_code=False,
            local_files_only=True
        )

        torch_dtype = torch.float16 if device_str == "cuda" else torch.float32
        self._model = AutoModelForSeq2SeqLM.from_pretrained(
            model_name,
            dtype=torch_dtype,
            trust_remote_code=False,
            local_files_only=True
        ).to(device_str)

        logger.info(f"Meta NLLB-200 loaded successfully on {device_str}.")

    def _unload_model_sync(self):
        import gc
        import torch

        if self._model is not None:
            del self._model
            self._model = None

        if self._tokenizer is not None:
            del self._tokenizer
            self._tokenizer = None

        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        logger.info("Meta NLLB-200 unloaded and GPU VRAM memory freed successfully.")

    async def translate(
        self,
        texts: List[str],
        source_lang: Optional[str],
        target_lang_code: str
    ) -> List[str]:
        async with self._lock:
            try:
                await asyncio.to_thread(self._load_model_sync)

                lang_meta = settings.SUPPORTED_TRANSLATION_LANGUAGES.get(target_lang_code.upper())
                if not lang_meta or "nllb" not in lang_meta:
                    raise TranslationException(f"Target language '{target_lang_code}' is not supported by NLLB.")

                target_nllb_code = lang_meta["nllb"]
                
                source_nllb_code = "eng_Latn"
                if source_lang and source_lang.upper() in settings.SUPPORTED_TRANSLATION_LANGUAGES:
                    source_nllb_code = settings.SUPPORTED_TRANSLATION_LANGUAGES[source_lang.upper()].get("nllb", "eng_Latn")

                def _infer_sync(batch_texts: List[str]) -> List[str]:
                    import torch
                    self._tokenizer.src_lang = source_nllb_code
                    inputs = self._tokenizer(
                        batch_texts,
                        return_tensors="pt",
                        padding=True,
                        truncation=True,
                        max_length=512
                    ).to(self._device)

                    target_lang_id = self._tokenizer.convert_tokens_to_ids(target_nllb_code)

                    with torch.no_grad():
                        generated_tokens = self._model.generate(
                            **inputs,
                            forced_bos_token_id=target_lang_id,
                            max_length=512
                        )

                    decoded = self._tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)
                    return [d.strip() for d in decoded]

                translated_results = []
                batch_size = 16
                for i in range(0, len(texts), batch_size):
                    chunk = texts[i:i + batch_size]
                    res = await asyncio.to_thread(_infer_sync, chunk)
                    translated_results.extend(res)

                return translated_results
            finally:
                await asyncio.to_thread(self._unload_model_sync)

class TranslationManager:
    def __init__(self):
        self.providers: Dict[str, BaseTranslationProvider] = {
            "deepl": DeepLTranslationProvider(),
            "nllb": MetaNLLBTranslationProvider(),
        }

    async def get_supported_engines(self) -> List[Dict[str, Any]]:
        engines = []
        for pid, provider in self.providers.items():
            status = "available" if provider.is_configured() else "unconfigured"
            usage_info = None
            if pid == "deepl" and provider.is_configured() and hasattr(provider, "get_usage"):
                try:
                    usage_info = await provider.get_usage()
                except Exception as e:
                    logger.warning(f"Failed to load DeepL usage info: {e}")

            engines.append({
                "id": pid,
                "name": provider.name,
                "status": status,
                "usage": usage_info
            })
        return engines

    def _load_segments_from_disk(self, job_id: str) -> List[Dict[str, Any]]:
        json_file = settings.OUTPUTS_DIR / f"{job_id}.json"
        if json_file.exists():
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("segments"):
                        return data.get("segments")
            except Exception as e:
                logger.warning(f"Failed to read JSON file from disk for job {job_id}: {e}")

        srt_file = settings.OUTPUTS_DIR / f"{job_id}.srt"
        if not srt_file.exists():
            return []

        segments = []
        try:
            with open(srt_file, "r", encoding="utf-8") as f:
                content = f.read().strip()

            blocks = content.split("\n\n")
            for block in blocks:
                lines = [line.strip() for line in block.split("\n") if line.strip()]
                if len(lines) >= 3:
                    try:
                        idx = int(lines[0])
                        time_range = lines[1]
                        text = " ".join(lines[2:])

                        start_str, end_str = time_range.split(" --> ")

                        def srt_to_seconds(ts: str) -> float:
                            parts = ts.replace(",", ".").split(":")
                            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])

                        segments.append({
                            "index": idx,
                            "start": round(srt_to_seconds(start_str), 2),
                            "end": round(srt_to_seconds(end_str), 2),
                            "text": text
                        })
                    except Exception:
                        continue
        except Exception as e:
            logger.warning(f"Failed to parse SRT file from disk for job {job_id}: {e}")

        return segments

    async def translate_job(
        self,
        job_id: str,
        target_lang_code: str,
        preferred_engine: str = "auto",
        input_segments: Optional[List[Dict[str, Any]]] = None,
        source_lang_code: Optional[str] = None
    ) -> Dict[str, Any]:
        target_code = target_lang_code.upper()
        if target_code not in settings.SUPPORTED_TRANSLATION_LANGUAGES:
            raise TranslationException(f"Unsupported target language code: {target_code}")

        lang_name = settings.SUPPORTED_TRANSLATION_LANGUAGES[target_code]["name"]

        cached_file = settings.OUTPUTS_DIR / f"{job_id}_{target_code}.json"
        if cached_file.exists():
            try:
                with open(cached_file, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                return cached_data
            except Exception as e:
                logger.warning(f"Failed to read cache file {cached_file}: {e}")

        if input_segments and len(input_segments) > 0:
            segments = input_segments
            source_lang = source_lang_code
        else:
            job_data = job_repo.get_job(job_id)
            if job_data and job_data.get("segments"):
                segments = job_data.get("segments", [])
                source_lang = job_data.get("language")
            else:
                segments = self._load_segments_from_disk(job_id)
                source_lang = job_data.get("language") if job_data else None

        if not segments:
            raise TranslationException(f"Job '{job_id}' not found or completed transcript files are missing.")

        original_texts = [seg["text"] for seg in segments]


        engine_used = ""
        translated_texts = []

        if preferred_engine != "auto" and preferred_engine in self.providers:
            provider = self.providers[preferred_engine]
            if not provider.is_configured():
                raise TranslationException(f"Engine '{preferred_engine}' is not configured.")
            translated_texts = await provider.translate(original_texts, source_lang, target_code)
            engine_used = provider.name
        else:
            success = False
            for pid in ["deepl", "nllb"]:
                provider = self.providers[pid]
                if not provider.is_configured():
                    continue
                try:
                    logger.info(f"Attempting translation for job {job_id} via {provider.name}...")
                    translated_texts = await provider.translate(original_texts, source_lang, target_code)
                    engine_used = provider.name
                    success = True
                    break
                except (QuotaExceededException, TranslationException) as exc:
                    logger.warning(f"Provider {provider.name} failed: {exc}. Trying next fallback...")
                    continue

            if not success or not translated_texts:
                raise TranslationException("All translation engines failed to process the request.")

        translated_segments = []
        for idx, (orig_seg, trans_text) in enumerate(zip(segments, translated_texts), start=1):
            translated_segments.append({
                "index": idx,
                "start": orig_seg["start"],
                "end": orig_seg["end"],
                "text": trans_text
            })

        response_payload = {
            "job_id": job_id,
            "target_language": target_code,
            "target_language_name": lang_name,
            "engine_selected": preferred_engine,
            "engine_used": engine_used,
            "segments": translated_segments
        }

        try:
            with open(cached_file, "w", encoding="utf-8") as f:
                json.dump(response_payload, f, ensure_ascii=False, indent=2)

            txt_path = settings.OUTPUTS_DIR / f"{job_id}_{target_code}.txt"
            srt_path = settings.OUTPUTS_DIR / f"{job_id}_{target_code}.srt"

            with open(txt_path, "w", encoding="utf-8") as f_txt, open(srt_path, "w", encoding="utf-8") as f_srt:
                for seg in translated_segments:
                    f_txt.write(f"[{seg['start']:.2f}s -> {seg['end']:.2f}s] {seg['text']}\n")

                    start_str = format_timestamp(seg["start"])
                    end_str = format_timestamp(seg["end"])
                    f_srt.write(f"{seg['index']}\n{start_str} --> {end_str}\n{seg['text']}\n\n")

        except Exception as e:
            logger.error(f"Failed to persist translated files for job {job_id}: {e}")

        return response_payload

translation_manager = TranslationManager()
