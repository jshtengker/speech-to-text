import sys
import os
from pathlib import Path

# Add backend directory to sys.path for Vercel module resolution
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.router import api_router

def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.DESCRIPTION,
        version=settings.VERSION
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router)

    return application

app = create_application()

if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
