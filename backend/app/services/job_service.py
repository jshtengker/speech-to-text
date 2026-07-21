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
        return self._jobs_db.get(job_id)

    def set_job(self, job_id: str, job_data: Dict[str, Any]):
        self._jobs_db[job_id] = job_data

    def get_active_job_count(self) -> int:
        return len([j for j in self._jobs_db.values() if j.get("status") in ["processing", "loading_model"]])

job_repo = JobRepository()
