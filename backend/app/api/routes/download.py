from typing import Optional
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.services.job_service import job_repo
from app.services.storage_service import storage_service

router = APIRouter(tags=["Download"])

@router.get("/download/{job_id}/{file_type}")
def download_transcript(
    job_id: str,
    file_type: str,
    lang: Optional[str] = Query(default=None)
):
    """Serves the generated .txt or .srt file for download (optionally translated if lang is specified)."""
    job_info = job_repo.get_job(job_id)
    target_file = storage_service.get_output_file(job_id, file_type, lang=lang)

    original_stem = Path(job_info["filename"]).stem if job_info and "filename" in job_info else f"transcript_{job_id[:8]}"
    suffix = f"_{lang.upper()}" if lang and lang.strip() else ""
    download_filename = f"{original_stem}{suffix}.{file_type}"

    return FileResponse(
        path=target_file,
        media_type="application/octet-stream",
        filename=download_filename
    )

