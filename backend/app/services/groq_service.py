import os
import time
import json
import logging
from pathlib import Path
import wave
from app.core.config import settings
from app.services.job_service import job_repo
from typing import Optional, Dict, Any, List, Tuple

try:
    from groq import Groq, RateLimitError, APIError, APIStatusError
except ImportError:
    Groq = None
    RateLimitError = Exception
    APIError = Exception
    APIStatusError = Exception

logger = logging.getLogger(__name__)


def _split_wav_file(wav_path: Path, max_bytes: int = 21 * 1024 * 1024) -> List[Tuple[Path, float]]:
    """Splits large WAV files into ~20 MB chunks using Python stdlib wave module."""
    if not wav_path.name.endswith(".wav") or not wav_path.exists() or wav_path.stat().st_size <= max_bytes:
        return [(wav_path, 0.0)]

    chunks = []
    try:
        with wave.open(str(wav_path), 'rb') as w_in:
            params = w_in.getparams()
            nchannels, sampwidth, framerate, nframes = params[:4]
            bytes_per_frame = nchannels * sampwidth
            if bytes_per_frame <= 0 or framerate <= 0:
                return [(wav_path, 0.0)]

            frames_per_chunk = max_bytes // bytes_per_frame
            chunk_idx = 0
            frames_read = 0

            while frames_read < nframes:
                to_read = min(frames_per_chunk, nframes - frames_read)
                frames_data = w_in.readframes(to_read)
                time_offset = frames_read / framerate

                chunk_file = wav_path.parent / f"{wav_path.stem}_chunk_{chunk_idx}.wav"
                with wave.open(str(chunk_file), 'wb') as w_out:
                    w_out.setparams(params)
                    w_out.writeframes(frames_data)

                chunks.append((chunk_file, time_offset))
                frames_read += to_read
                chunk_idx += 1

        return chunks if chunks else [(wav_path, 0.0)]
    except Exception as e:
        logger.warning(f"Could not split WAV file, processing original: {e}")
        return [(wav_path, 0.0)]


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
        key = str(settings.GROQ_API_KEY or "").strip()
        return bool(key)


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

        if Groq is None:
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
            outputs_dir = Path(outputs_dir_str)
            media_path = Path(media_path_str)

            assert Groq is not None, "Groq SDK is not installed"
            api_key = (settings.GROQ_API_KEY or "").strip()
            client = Groq(api_key=api_key)




            chunks = _split_wav_file(media_path)
            raw_segments = []
            detected_lang = "EN"
            primary_language = None
            if language and language.strip():
                lang_clean = language.strip().lower()
                lang_map = {
                    "english": "en", "indonesian": "id", "korean": "ko", "japanese": "ja",
                    "spanish": "es", "french": "fr", "german": "de", "chinese": "zh",
                    "italian": "it", "portuguese": "pt", "dutch": "nl", "russian": "ru",
                    "arabic": "ar", "hindi": "hi", "vietnamese": "vi", "thai": "th",
                    "turkish": "tr", "polish": "pl", "swedish": "sv", "danish": "da",
                    "finnish": "fi", "norwegian": "no", "greek": "el", "czech": "cs", "hungarian": "hu"
                }
                primary_language = lang_map.get(lang_clean, lang_clean)
                # If language code is longer than 3 chars and unmapped, ignore it so Groq auto-detects instead of throwing 400
                if len(primary_language) > 3:
                    primary_language = None

            for chunk_idx, (chunk_path, time_offset) in enumerate(chunks):
                with open(chunk_path, "rb") as file_obj:
                    extra_args = {}
                    # Use explicit language or carry over detected language from chunk 1
                    current_lang = primary_language or (detected_lang.lower() if chunk_idx > 0 and detected_lang else None)
                    if current_lang:
                        extra_args["language"] = current_lang

                    response = client.audio.transcriptions.create(
                        file=(chunk_path.name, file_obj),
                        model="whisper-large-v3",
                        response_format="verbose_json",
                        **extra_args
                    )

                resp_dict = response.model_dump() if hasattr(response, "model_dump") else dict(response)

                if chunk_idx == 0:
                    detected_lang = resp_dict.get("language", "en").upper()
                    ipc_queue.put({"event": "info", "data": {"language": detected_lang, "language_probability": 1.0}})

                chunk_segs = resp_dict.get("segments", [])
                if not chunk_segs and "text" in resp_dict:
                    chunk_segs = [{
                        "id": 1,
                        "start": 0.0,
                        "end": 0.0,
                        "text": resp_dict["text"]
                    }]

                for seg in chunk_segs:
                    seg["start"] = float(seg.get("start", 0.0)) + time_offset
                    seg["end"] = float(seg.get("end", 0.0)) + time_offset
                    raw_segments.append(seg)

                if chunk_path != media_path and chunk_path.exists():
                    try:
                        os.remove(chunk_path)
                    except Exception:
                        pass



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
            json_path = outputs_dir / f"{job_id}.json"
            job_json_data = {
                "job_id": job_id,
                "filename": Path(media_path).name,
                "model": "groq-large-v3",
                "status": "completed",
                "created_at": start_time,
                "completed_at": time.time(),
                "execution_time": elapsed,
                "language": detected_lang,
                "language_probability": 1.0,
                "total_segments": len(segment_list),
                "segments": segment_list,
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


            # Update in-memory job repository for active request threads / API queries
            if job_id in job_repo.jobs_db:
                job_repo.jobs_db[job_id]["status"] = "completed"
                job_repo.jobs_db[job_id]["segments"] = segment_list
                job_repo.jobs_db[job_id]["total_segments"] = len(segment_list)
                job_repo.jobs_db[job_id]["language"] = detected_lang
                job_repo.jobs_db[job_id]["language_probability"] = 1.0
                job_repo.jobs_db[job_id]["execution_time"] = elapsed
                job_repo.jobs_db[job_id]["completed_at"] = time.time()

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
            err_msg = "Groq API Rate Limit reached. Please wait a few minutes before trying again."
            if job_id in job_repo.jobs_db:
                job_repo.jobs_db[job_id]["status"] = "failed"
                job_repo.jobs_db[job_id]["error"] = err_msg
            ipc_queue.put({
                "event": "status",
                "data": {
                    "status": "failed",
                    "error": err_msg
                }
            })
        except Exception as e:
            err_msg = f"Groq API Error ({type(e).__name__}): {str(e)}"
            logger.error(f"Groq API transcription error for job {job_id}: {err_msg}")

            if job_id in job_repo.jobs_db:
                job_repo.jobs_db[job_id]["status"] = "failed"
                job_repo.jobs_db[job_id]["error"] = err_msg

            json_path = outputs_dir / f"{job_id}.json"
            failed_job_data = {
                "job_id": job_id,
                "filename": Path(media_path).name if 'media_path' in locals() else "media_file",
                "model": "groq-large-v3",
                "status": "failed",
                "created_at": start_time if 'start_time' in locals() else time.time(),
                "completed_at": time.time(),
                "error": err_msg,
                "total_segments": 0,
                "segments": [],
                "downloads": {}
            }
            try:
                with open(json_path, "w", encoding="utf-8") as f_json:
                    json.dump(failed_job_data, f_json, ensure_ascii=False, indent=2)
            except Exception:
                pass

            ipc_queue.put({
                "event": "status",
                "data": {
                    "status": "failed",
                    "error": err_msg
                }
            })


groq_service = GroqTranscriptionService()
