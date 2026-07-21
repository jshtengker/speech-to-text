export interface TranscriptSegment {
  index: number;
  start: number;
  end: number;
  text: string;
}

export interface JobDownloadLinks {
  txt: string;
  srt: string;
}

export interface JobStatusResponse {
  job_id: string;
  filename: string;
  model?: string;
  status: 'pending' | 'loading_model' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: number;
  completed_at?: number | null;
  execution_time?: number | null;
  language?: string | null;
  language_probability?: number | null;
  total_segments: number;
  error?: string | null;
  downloads: JobDownloadLinks;
}

export interface HealthStatusResponse {
  status: string;
  cuda_available: boolean;
  device: 'cuda' | 'cpu';
  active_jobs: number;
}

export interface TranscribeResponse {
  job_id: string;
  filename: string;
  model?: string;
  status: string;
  message: string;
}

export interface PaginatedSegmentsResponse {
  job_id: string;
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  segments: TranscriptSegment[];
}

export interface TranscribeOptions {
  model?: string;
  language?: string;
  vadFilter?: boolean;
  beamSize?: number;
}

export interface WhisperModelInfo {
  id: string;
  name: string;
  vram: string;
  description: string;
  default: boolean;
}
