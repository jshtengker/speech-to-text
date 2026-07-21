import os
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException
from app.core.config import settings

class StorageService:
    @staticmethod
    async def save_upload_file(file: UploadFile, job_id: str) -> Path:
        safe_filename = file.filename or "uploaded_media"
        temp_media_path = settings.UPLOADS_DIR / f"{job_id}_{safe_filename}"
        with open(temp_media_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        return temp_media_path

    @staticmethod
    def cleanup_file(path: Path):
        if path.exists():
            try:
                os.remove(path)
            except Exception:
                pass

    @staticmethod
    def cleanup_job_outputs(job_id: str):
        for ext in [".txt", ".srt"]:
            out_file = settings.OUTPUTS_DIR / f"{job_id}{ext}"
            if out_file.exists():
                try:
                    os.remove(out_file)
                except Exception:
                    pass

    @staticmethod
    def get_output_file(job_id: str, file_type: str) -> Path:
        if file_type not in ["txt", "srt"]:
            raise HTTPException(status_code=400, detail="Invalid file type. Must be 'txt' or 'srt'.")
        
        target_file = settings.OUTPUTS_DIR / f"{job_id}.{file_type}"
        if not target_file.exists():
            raise HTTPException(status_code=404, detail=f"Requested {file_type.upper()} file is not available.")
        return target_file

storage_service = StorageService()
