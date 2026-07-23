import os
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException
from app.core.config import settings

class StorageService:
    @staticmethod
    async def save_upload_file(file: UploadFile, job_id: str) -> Path:
        safe_filename = file.filename or "uploaded_media"
        file_ext = Path(safe_filename).suffix.lower()

        if file_ext not in settings.ALLOWED_EXTENSIONS:
            allowed_str = ", ".join(sorted(settings.ALLOWED_EXTENSIONS))
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file extension '{file_ext}'. Allowed extensions: {allowed_str}"
            )

        temp_media_path = settings.UPLOADS_DIR / f"{job_id}_{safe_filename}"
        chunk_size = 1024 * 1024
        written_bytes = 0

        try:
            with open(temp_media_path, "wb") as buffer:
                while chunk := await file.read(chunk_size):
                    written_bytes += len(chunk)
                    if written_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail=f"File size exceeds maximum allowed limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024 * 1024)} GB."
                        )
                    buffer.write(chunk)
        except Exception:
            if temp_media_path.exists():
                try:
                    os.remove(temp_media_path)
                except Exception:
                    pass
            raise

        return temp_media_path

    @staticmethod
    async def save_url_file(file_url: str, job_id: str) -> Path:
        import httpx
        from urllib.parse import urlparse

        parsed_url = urlparse(file_url)
        raw_name = Path(parsed_url.path).name or "audio.mp3"
        safe_filename = raw_name if Path(raw_name).suffix else f"{raw_name}.mp3"

        temp_media_path = settings.UPLOADS_DIR / f"{job_id}_{safe_filename}"

        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            async with client.stream("GET", file_url) as response:
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to download audio from Cloud Storage. HTTP Status: {response.status_code}")
                with open(temp_media_path, "wb") as buffer:
                    async for chunk in response.aiter_bytes():
                        buffer.write(chunk)

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
    def get_output_file(job_id: str, file_type: str, lang: Optional[str] = None) -> Path:
        if file_type not in ["txt", "srt"]:
            raise HTTPException(status_code=400, detail="Invalid file type. Must be 'txt' or 'srt'.")
        
        if lang and lang.strip():
            target_file = settings.OUTPUTS_DIR / f"{job_id}_{lang.strip().upper()}.{file_type}"
        else:
            target_file = settings.OUTPUTS_DIR / f"{job_id}.{file_type}"

        if not target_file.exists():
            raise HTTPException(status_code=404, detail=f"Requested {file_type.upper()} file is not available.")
        return target_file


storage_service = StorageService()
