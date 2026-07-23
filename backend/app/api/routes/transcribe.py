import uuid
import time
import json
import asyncio
import multiprocessing
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Query, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.schemas.job import JobSubmitResponse, JobStatusResponse, JobCancelResponse
from app.schemas.segment import SegmentPaginatedResponse, SegmentItem
from app.services.job_service import job_repo
from app.services.storage_service import storage_service
from app.services.whisper_service import run_whisper_worker, monitor_job_process
from app.services.groq_service import groq_service

router = APIRouter(tags=["Transcription"])

@router.post("/transcribe", status_code=202, response_model=JobSubmitResponse)
async def create_transcription_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form(default="turbo"),
    language: Optional[str] = Form(default=None),
    vad_filter: bool = Form(default=True),
    beam_size: int = Form(default=5)
):
    """Submits an audio or video file for background transcription."""
    job_id = str(uuid.uuid4())
    temp_media_path = await storage_service.save_upload_file(file, job_id)
    safe_filename = file.filename or "uploaded_media"

    supported_models = settings.SUPPORTED_MODELS
    selected_model = model if model in supported_models else ("groq-large-v3" if not settings.ENABLE_LOCAL_MODELS else "turbo")

    # Validate model selection against Cloud Mode restrictions
    if not settings.ENABLE_LOCAL_MODELS and selected_model != "groq-large-v3":
        raise HTTPException(
            status_code=400,
            detail="Local PyTorch Whisper models are disabled on this cloud deployment instance. Please select 'Groq Cloud (Whisper Large-v3)'."
        )

    job_data = {
        "job_id": job_id,
        "filename": safe_filename,
        "model": selected_model,
        "status": "pending",
        "created_at": time.time(),
        "completed_at": None,
        "execution_time": None,
        "language": None,
        "language_probability": None,
        "total_segments": 0,
        "segments": [],
        "error": None,
        "downloads": {
            "txt": f"/api/download/{job_id}/txt",
            "srt": f"/api/download/{job_id}/srt"
        }
    }
    job_repo.set_job(job_id, job_data)
    job_repo.job_queues[job_id] = asyncio.Queue()
    main_loop = asyncio.get_running_loop()

    import queue
    import threading

    # Route job to Groq Cloud Service or Local Whisper Worker
    if selected_model == "groq-large-v3":
        ipc_queue = queue.Queue()
        target_func = groq_service.run_transcription
        target_args = (
            job_id,
            str(temp_media_path),
            language if language and language.strip() else None,
            ipc_queue,
            str(settings.OUTPUTS_DIR)
        )
        proc = threading.Thread(target=target_func, args=target_args)
    else:
        ipc_queue = multiprocessing.Queue()
        target_func = run_whisper_worker
        target_args = (
            job_id,
            str(temp_media_path),
            selected_model,
            language if language and language.strip() else None,
            vad_filter,
            beam_size,
            ipc_queue,
            str(settings.OUTPUTS_DIR)
        )
        proc = multiprocessing.Process(target=target_func, args=target_args)

    proc.start()
    job_repo.active_processes[job_id] = proc

    background_tasks.add_task(
        monitor_job_process,
        job_id=job_id,
        media_path=temp_media_path,
        ipc_queue=ipc_queue,
        main_loop=main_loop
    )

    return JobSubmitResponse(
        job_id=job_id,
        filename=safe_filename,
        model=selected_model,
        status="pending",
        message="Transcription job queued successfully."
    )

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    """Returns high-level metadata, status, and summary metrics for a job."""
    job_info = job_repo.get_job(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail="Job not found")
    
    info_copy = job_info.copy()
    info_copy.pop("segments", None)
    return JobStatusResponse(**info_copy)

@router.post("/jobs/{job_id}/cancel", response_model=JobCancelResponse)
def cancel_job(job_id: str):
    """Cancels an active transcription job and forcefully terminates the GPU worker process."""
    job_info = job_repo.get_job(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail="Job not found")
    
    current_status = job_info.get("status")
    if current_status in ["completed", "failed", "cancelled"]:
        return JobCancelResponse(
            message=f"Job is already {current_status}.",
            job_id=job_id,
            status=current_status
        )
    
    job_info["status"] = "cancelled"
    
    proc = job_repo.active_processes.get(job_id)
    if proc and proc.is_alive():
        print(f"--> Instantly terminating GPU worker process for job '{job_id}' (PID: {proc.pid})...")
        proc.terminate()
        proc.join(timeout=1)
        if proc.is_alive():
            proc.kill()
        job_repo.active_processes.pop(job_id, None)
    
    if job_id in job_repo.job_queues:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    job_repo.job_queues[job_id].put({"event": "status", "data": {"status": "cancelled"}}),
                    loop
                )
        except Exception:
            pass

    storage_service.cleanup_job_outputs(job_id)

    return JobCancelResponse(
        message="Job cancelled and GPU process terminated.",
        job_id=job_id,
        status="cancelled"
    )

@router.get("/jobs/{job_id}/segments", response_model=SegmentPaginatedResponse)
def get_job_segments(
    job_id: str,
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=500, description="Items per page")
):
    """Returns paginated segments for a transcription job."""
    job_info = job_repo.get_job(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail="Job not found")

    segments = job_info.get("segments", [])
    total_items = len(segments)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit

    paginated = [SegmentItem(**seg) for seg in segments[start_idx:end_idx]]

    return SegmentPaginatedResponse(
        job_id=job_id,
        page=page,
        limit=limit,
        total_items=total_items,
        total_pages=(total_items + limit - 1) // limit if total_items > 0 else 1,
        segments=paginated
    )

@router.get("/jobs/{job_id}/stream")
async def stream_job_events(job_id: str, request: Request):
    """Streams real-time Server-Sent Events (SSE) as transcription segments are generated."""
    job_info = job_repo.get_job(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail="Job not found")

    queue = job_repo.job_queues.get(job_id)
    if not queue:
        queue = asyncio.Queue()
        job_repo.job_queues[job_id] = queue

    async def event_generator():
        current_status = job_info["status"]
        yield f"event: status\ndata: {json.dumps({'status': current_status})}\n\n"

        if current_status in ["completed", "failed", "cancelled"]:
            yield f"event: complete\ndata: {json.dumps({'status': current_status})}\n\n"
            return

        while True:
            if await request.is_disconnected():
                break
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=5.0)
                event_name = msg.get("event")
                event_data = json.dumps(msg.get("data", {}))
                yield f"event: {event_name}\ndata: {event_data}\n\n"

                if event_name in ["complete", "error", "cancelled"]:
                    break
            except asyncio.TimeoutError:
                c_status = job_repo.jobs_db.get(job_id, {}).get("status")
                if c_status in ["completed", "failed", "cancelled"]:
                    break
                yield ": keep-alive\n\n"
            except (asyncio.CancelledError, Exception):
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
