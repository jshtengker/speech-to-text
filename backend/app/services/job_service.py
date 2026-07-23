import asyncio
import multiprocessing
from typing import Dict, Any, Optional

class JobRepository:
    def __init__(self):
        self._jobs_db: Dict[str, Dict[str, Any]] = {}
        self._job_queues: Dict[str, asyncio.Queue] = {}
        self._active_processes: Dict[str, multiprocessing.Process] = {}

    @property
    def jobs_db(self) -> Dict[str, Dict[str, Any]]:
        return self._jobs_db

    @property
    def job_queues(self) -> Dict[str, asyncio.Queue]:
        return self._job_queues

    @property
    def active_processes(self) -> Dict[str, multiprocessing.Process]:
        return self._active_processes

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self._jobs_db.get(job_id)
        if job:
            return job

        # Fallback for serverless container isolation: read cached JSON from OUTPUTS_DIR
        try:
            import json
            from app.core.config import settings
            json_path = settings.OUTPUTS_DIR / f"{job_id}.json"
            if json_path.exists():
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._jobs_db[job_id] = data
                    return data
        except Exception:
            pass
        return None


    def set_job(self, job_id: str, job_data: Dict[str, Any]):
        self._jobs_db[job_id] = job_data

    def get_active_job_count(self) -> int:
        return len([j for j in self._jobs_db.values() if j.get("status") in ["processing", "loading_model"]])

job_repo = JobRepository()
