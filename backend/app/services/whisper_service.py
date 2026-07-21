import os
import time
import asyncio
import multiprocessing
from pathlib import Path
from typing import Optional, Dict, Any

from app.core.config import settings
from app.services.job_service import job_repo
from app.services.storage_service import storage_service

def is_model_cached(model_name: str) -> bool:
    """Checks if faster-whisper model files exist in local HuggingFace cache directory."""
    cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
    if not cache_dir.exists():
        return False
    
    search_term = model_name.lower()
    for d in cache_dir.iterdir():
        if d.is_dir() and d.name.startswith("models--"):
            if search_term in d.name.lower():
                snapshots_dir = d / "snapshots"
                if snapshots_dir.exists() and any(snapshots_dir.iterdir()):
                    return True
    return False

def run_whisper_worker(
    job_id: str,
    media_path_str: str,
    model_name: str,
    language: Optional[str],
    vad_filter: bool,
    beam_size: int,
    ipc_queue: Any,
    outputs_dir_str: str
):
    """Isolated worker process executing CTranslate2 CUDA inference. Can be forcefully killed by OS on cancellation."""
    try:
        from faster_whisper import WhisperModel
        import time

        ipc_queue.put({"event": "status", "data": {"status": "loading_model"}})
        
        start_time = time.time()
        try:
            model = WhisperModel(model_name, device="cuda", compute_type="float16")
        except Exception:
            model = WhisperModel(model_name, device="cpu", compute_type="int8")

        ipc_queue.put({"event": "status", "data": {"status": "processing"}})

        segments_generator, info = model.transcribe(
            media_path_str,
            beam_size=beam_size,
            vad_filter=vad_filter,
            language=language
        )

        detected_lang = info.language.upper()
        prob = round(info.language_probability, 4)

        ipc_queue.put({"event": "info", "data": {"language": detected_lang, "language_probability": prob}})

        outputs_dir = Path(outputs_dir_str)
        txt_file_path = outputs_dir / f"{job_id}.txt"
        srt_file_path = outputs_dir / f"{job_id}.srt"

        segment_list = []
        with open(txt_file_path, "w", encoding="utf-8") as f_txt, open(srt_file_path, "w", encoding="utf-8") as f_srt:
            for index, seg in enumerate(segments_generator, start=1):
                seg_text = seg.text.strip()
                seg_item = {
                    "index": index,
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg_text
                }
                segment_list.append(seg_item)
                ipc_queue.put({"event": "segment", "data": seg_item})

                f_txt.write(f"[{seg.start:.2f}s -> {seg.end:.2f}s] {seg_text}\n")

                hours = int(seg.start // 3600)
                minutes = int((seg.start % 3600) // 60)
                secs = int(seg.start % 60)
                millis = int((seg.start - int(seg.start)) * 1000)
                start_str = f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

                hours_e = int(seg.end // 3600)
                minutes_e = int((seg.end % 3600) // 60)
                secs_e = int(seg.end % 60)
                millis_e = int((seg.end - int(seg.end)) * 1000)
                end_str = f"{hours_e:02d}:{minutes_e:02d}:{secs_e:02d},{millis_e:03d}"

                f_srt.write(f"{index}\n{start_str} --> {end_str}\n{seg_text}\n\n")

        elapsed = round(time.time() - start_time, 2)
        ipc_queue.put({"event": "complete", "data": {
            "status": "completed",
            "execution_time": elapsed,
            "total_segments": len(segment_list)
        }})

    except Exception as e:
        ipc_queue.put({"event": "error", "data": {"error": str(e)}})

async def monitor_job_process(
    job_id: str,
    media_path: Path,
    ipc_queue: Any,
    main_loop: asyncio.AbstractEventLoop
):
    """Relays IPC queue events from worker process to SSE streaming client."""
    def send_sse_event(event_type: str, data: Dict[str, Any]):
        if job_id in job_repo.job_queues and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(
                job_repo.job_queues[job_id].put({"event": event_type, "data": data}),
                main_loop
            )

    try:
        while True:
            try:
                msg = await asyncio.to_thread(ipc_queue.get, True, 0.5)
            except Exception:
                job_st = job_repo.jobs_db.get(job_id, {}).get("status")
                if job_st in ["cancelled", "completed", "failed"]:
                    break
                proc = job_repo.active_processes.get(job_id)
                if proc and not proc.is_alive():
                    break
                continue

            event_name = msg.get("event")
            event_data = msg.get("data", {})

            if event_name == "status":
                new_st = event_data.get("status")
                if new_st and job_id in job_repo.jobs_db:
                    job_repo.jobs_db[job_id]["status"] = new_st
                send_sse_event("status", event_data)

            elif event_name == "info":
                if job_id in job_repo.jobs_db:
                    job_repo.jobs_db[job_id]["language"] = event_data.get("language")
                    job_repo.jobs_db[job_id]["language_probability"] = event_data.get("language_probability")
                send_sse_event("info", event_data)

            elif event_name == "segment":
                if job_id in job_repo.jobs_db:
                    job_repo.jobs_db[job_id]["segments"].append(event_data)
                    job_repo.jobs_db[job_id]["total_segments"] = len(job_repo.jobs_db[job_id]["segments"])
                send_sse_event("segment", event_data)

            elif event_name == "complete":
                if job_id in job_repo.jobs_db:
                    job_repo.jobs_db[job_id]["status"] = "completed"
                    job_repo.jobs_db[job_id]["execution_time"] = event_data.get("execution_time")
                    job_repo.jobs_db[job_id]["completed_at"] = time.time()
                    downloads = job_repo.jobs_db[job_id]["downloads"]
                else:
                    downloads = {}

                send_sse_event("complete", {
                    "status": "completed",
                    "execution_time": event_data.get("execution_time"),
                    "total_segments": event_data.get("total_segments"),
                    "downloads": downloads
                })
                break

            elif event_name == "error":
                if job_id in job_repo.jobs_db:
                    job_repo.jobs_db[job_id]["status"] = "failed"
                    job_repo.jobs_db[job_id]["error"] = event_data.get("error")
                send_sse_event("error", event_data)
                break

    finally:
        job_repo.active_processes.pop(job_id, None)
        storage_service.cleanup_file(media_path)

        if job_repo.jobs_db.get(job_id, {}).get("status") == "cancelled":
            storage_service.cleanup_job_outputs(job_id)

        job_repo.job_queues.pop(job_id, None)
