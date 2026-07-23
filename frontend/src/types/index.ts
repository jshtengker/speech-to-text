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
  is_cloud?: boolean;
}

export interface ModelListResponse {
  models: WhisperModelInfo[];
<<<<<<< HEAD
  groq_configured?: boolean;
  enable_local_models?: boolean;
}

export interface LanguageOption {
  code: string;
  name: string;
}

export interface DeepLUsageInfo {
  character_count: number;
  character_limit: number;
  remaining_characters: number;
  percent_remaining: number;
}

export interface EngineOption {
  id: string;
  name: string;
  status: 'available' | 'unconfigured' | 'active';
  usage?: DeepLUsageInfo | null;
}

export interface SupportedLanguagesResponse {
  languages: LanguageOption[];
  engines: EngineOption[];
}

export interface TranslationResponse {
  job_id: string;
  target_language: string;
  target_language_name: string;
  engine_selected: string;
  engine_used: string;
  segments: TranscriptSegment[];
=======
  is_cloud: boolean;
  groq_configured: boolean;
  enable_local_models: boolean;
>>>>>>> dad4db8 (add: supabase storage configs)
}

