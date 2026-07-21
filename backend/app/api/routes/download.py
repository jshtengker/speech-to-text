from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.job_service import job_repo
from app.services.storage_service import storage_service

router = APIRouter(tags=["Download"])

@router.get("/download/{job_id}/{file_type}")
def download_transcript(job_id: str, file_type: str):
    """Serves the generated .txt or .srt file for download."""
    job_info = job_repo.get_job(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail="Job not found")

    target_file = storage_service.get_output_file(job_id, file_type)

    original_stem = Path(job_info["filename"]).stem
    download_filename = f"{original_stem}.{file_type}"

    return FileResponse(
        path=target_file,
        media_type="application/octet-stream",
        filename=download_filename
    )
