import os
import time
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)

class GroqServiceException(Exception):
    """Base exception for Groq service errors."""
    pass

class GroqRateLimitException(GroqServiceException):
    """Raised when Groq API rate limits are reached."""
    pass

class GroqTranscriptionService:
    def __init__(self):
        self._last_usage_info: Optional[Dict[str, Any]] = None

    def is_configured(self) -> bool:
        return bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())

    def get_usage_info(self) -> Optional[Dict[str, Any]]:
        return self._last_usage_info

    def run_transcription(
        self,
        job_id: str,
        media_path_str: str,
        language: Optional[str],
        ipc_queue: Any,
        outputs_dir_str: str
    ):
        """
        Executes cloud audio transcription via Groq LPU API (whisper-large-v3).
        Emits real-time SSE progress events to IPC queue and saves .txt / .srt files.
        """
        if not self.is_configured():
            ipc_queue.put({
                "event": "status",
                "data": {
                    "status": "failed",
                    "error": "Groq API Key is missing. Please set GROQ_API_KEY environment variable."
                }
            })
            return

        try:
            from groq import Groq, RateLimitError, APIError
        except ImportError:
            ipc_queue.put({
                "event": "status",
                "data": {
                    "status": "failed",
                    "error": "Python 'groq' package is not installed."
                }
            })
            return

        try:
            ipc_queue.put({"event": "status", "data": {"status": "processing"}})
            start_time = time.time()

            client = Groq(api_key=settings.GROQ_API_KEY.strip())
            media_path = Path(media_path_str)

            with open(media_path, "rb") as file_obj:
                extra_args = {}
                if language and language.strip():
                    extra_args["language"] = language.strip().lower()

                # Call Groq Whisper API with verbose JSON format for detailed timestamps
                response = client.audio.transcriptions.create(
                    file=(media_path.name, file_obj),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    **extra_args
                )

            # Inspect response dictionary or object
            resp_dict = response.model_dump() if hasattr(response, "model_dump") else dict(response)

            detected_lang = resp_dict.get("language", "en").upper()
            ipc_queue.put({"event": "info", "data": {"language": detected_lang, "language_probability": 1.0}})

            raw_segments = resp_dict.get("segments", [])
            
            # If no segment details returned, fallback to full text
            if not raw_segments and "text" in resp_dict:
                raw_segments = [{
                    "id": 1,
                    "start": 0.0,
                    "end": 0.0,
                    "text": resp_dict["text"]
                }]

            outputs_dir = Path(outputs_dir_str)
            txt_file_path = outputs_dir / f"{job_id}.txt"
            srt_file_path = outputs_dir / f"{job_id}.srt"

            segment_list = []
            with open(txt_file_path, "w", encoding="utf-8") as f_txt, open(srt_file_path, "w", encoding="utf-8") as f_srt:
                for index, seg in enumerate(raw_segments, start=1):
                    seg_text = str(seg.get("text", "")).strip()
                    start_sec = round(float(seg.get("start", 0.0)), 2)
                    end_sec = round(float(seg.get("end", 0.0)), 2)

                    seg_item = {
                        "index": index,
                        "start": start_sec,
                        "end": end_sec,
                        "text": seg_text
                    }
                    segment_list.append(seg_item)
                    ipc_queue.put({"event": "segment", "data": seg_item})

                    f_txt.write(f"[{start_sec:.2f}s -> {end_sec:.2f}s] {seg_text}\n")

                    # Generate SRT timestamp strings
                    hours = int(start_sec // 3600)
                    minutes = int((start_sec % 3600) // 60)
                    secs = int(start_sec % 60)
                    millis = int((start_sec - int(start_sec)) * 1000)
                    start_str = f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

                    hours_e = int(end_sec // 3600)
                    minutes_e = int((end_sec % 3600) // 60)
                    secs_e = int(end_sec % 60)
                    millis_e = int((end_sec - int(end_sec)) * 1000)
                    end_str = f"{hours_e:02d}:{minutes_e:02d}:{secs_e:02d},{millis_e:03d}"

                    f_srt.write(f"{index}\n{start_str} --> {end_str}\n{seg_text}\n\n")

            elapsed = round(time.time() - start_time, 2)
            
            # Save job metadata & segments JSON for serverless multi-instance persistence
            json_path = outputs_path / f"{job_id}.json"
            job_json_data = {
                "job_id": job_id,
                "filename": Path(media_path).name,
                "model": "groq-large-v3",
                "status": "completed",
                "created_at": start_time,
                "completed_at": time.time(),
                "execution_time": elapsed,
                "language": detected_language,
                "language_probability": 1.0,
                "total_segments": len(all_segments),
                "segments": all_segments,
                "downloads": {
                    "txt": f"/api/download/{job_id}/txt",
                    "srt": f"/api/download/{job_id}/srt"
                }
            }
            try:
                with open(json_path, "w", encoding="utf-8") as f_json:
                    json.dump(job_json_data, f_json, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.warning(f"Could not save JSON output cache for job {job_id}: {e}")

            ipc_queue.put({"event": "complete", "data": {
                "status": "completed",
                "execution_time": elapsed,
                "output_files": {
                    "txt": f"/api/download/{job_id}/txt",
                    "srt": f"/api/download/{job_id}/srt"
                }
            }})


        except RateLimitError as rle:
            logger.error(f"Groq API Rate Limit reached for job {job_id}: {rle}")
            ipc_queue.put({
                "event": "status",
                "data": {
                    "status": "failed",
                    "error": "Groq API Rate Limit reached. Please wait a few minutes before trying again."
                }
            })
        except Exception as e:
            logger.error(f"Groq API transcription error for job {job_id}: {e}")
            ipc_queue.put({
                "event": "status",
                "data": {
                    "status": "failed",
                    "error": f"Groq API transcription error: {str(e)}"
                }
            })

groq_service = GroqTranscriptionService()
