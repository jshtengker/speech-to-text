const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorMessage = `API request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Ignore JSON parsing errors for non-JSON response bodies
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

import { ModelListResponse } from '@/types';

export async function translateTranscript(
  jobId: string,
  targetLanguage: string,
  engine: string = 'auto',
  segments?: import('../types').TranscriptSegment[],
  sourceLanguage?: string
) {
  return apiFetch<import('../types').TranslationResponse>('/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      job_id: jobId,
      target_language: targetLanguage,
      engine: engine,
      segments: segments && segments.length > 0 ? segments : undefined,
      source_language: sourceLanguage || undefined,
    }),
  });
}

export async function getTranslationLanguages() {
  return apiFetch<import('../types').SupportedLanguagesResponse>('/api/translate/languages');
}

export async function fetchSupportedModels(): Promise<ModelListResponse> {
  return apiFetch<ModelListResponse>('/api/models');
}


