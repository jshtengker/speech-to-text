# 🎙️ Local Speech-to-Text Application

A high-performance, local, GPU-accelerated **Speech-to-Text Transcription Web Application** built with **FastAPI**, **`faster-whisper`**, and a modern **React + TypeScript + Vite** frontend.

---

## ✨ Features

- **🔒 Local & Privacy-First**: Runs OpenAI Whisper models entirely on your local machine—no data sent to external APIs or third-party cloud services.
- **⚡ Fast & GPU-Accelerated**: Powered by `faster-whisper` (CTranslate2 execution engine) supporting CUDA acceleration.
- **📡 Real-Time SSE Streaming**: Streams transcription output line-by-line in real time using Server-Sent Events (SSE).
- **🎛️ Dynamic Model Selection**: Choose between various Whisper model sizes (`turbo`, `large-v3`, `medium`, `small`, `base`, `tiny`) based on your VRAM & performance requirements.
- **📥 Multiple Export Formats**: Download completed transcriptions as plain text (`.txt`) or subtitle files (`.srt`).
- **🎨 Modern UI**: Built with React 18, TypeScript, TailwindCSS v4, and Lucide React icons featuring a sleek dark theme, drag-and-drop uploader, and live progress streaming viewer.

---

## 📁 Repository Structure

```text
speech-to-text/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # API Endpoints (health, models, transcribe, download)
│   │   ├── core/             # Application Configuration & Settings
│   │   ├── schemas/          # Pydantic Data Validation Schemas
│   │   ├── services/         # Whisper, Job State, & File Storage Services
│   │   └── utils/            # Helper utilities
│   ├── uploads/              # Temp directory for uploaded media (auto-created)
│   ├── outputs/              # Temp directory for generated transcripts (auto-created)
│   ├── main.py               # FastAPI entry point
│   └── requirements.txt      # Python dependencies
│
├── frontend/                 # React + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── components/       # Uploader, Viewer, Transcript, Header components
│   │   ├── services/         # API Client & SSE event stream integration
│   │   ├── types/            # TypeScript interfaces
│   │   ├── App.tsx           # Main Application Component
│   │   └── main.tsx          # Application Entry Point
│   ├── package.json          # Node dependencies & scripts
│   └── vite.config.ts        # Vite configuration & dev server proxy
│
└── README.md                 # Project documentation
```

---

## 🛠️ Prerequisites

- **Python**: 3.10 or higher
- **Node.js**: v18 or higher (with `pnpm` or `npm`)
- **FFmpeg**: Required by Whisper for audio processing. Must be installed and available in your system PATH.
- **DEDICATED GPU (Optional)**: CUDA-capable GPU for faster GPU inference (falls back to CPU automatically).

---

## 🚀 Getting Started

### 1. Backend Setup (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # On Windows (PowerShell):
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # On macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the FastAPI development server:
   ```bash
   python main.py
   # OR: uvicorn main:app --reload --port 8000
   ```

   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

### 2. Frontend Setup (React + Vite)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   # OR: npm install
   ```

3. Start the Vite development server:
   ```bash
   pnpm dev
   # OR: npm run dev
   ```

4. Open your browser and navigate to **[http://localhost:5173](http://localhost:5173)**.

---

## 📡 API Routes Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check endpoint returning backend status |
| `/api/models` | `GET` | Lists available Whisper models & VRAM recommendations |
| `/api/transcribe` | `POST` | Uploads media file and initiates transcription job |
| `/api/transcribe/{job_id}/stream` | `GET` | SSE stream for real-time transcription line updates |
| `/api/download/{job_id}` | `GET` | Download output file (`txt` or `srt`) |

