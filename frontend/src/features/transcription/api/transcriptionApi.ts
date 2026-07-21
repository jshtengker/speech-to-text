import { apiFetch } from '@/services/apiClient';
import { JobStatusResponse, PaginatedSegmentsResponse } from '@/types';

/**
 * Fetches status metadata for a specific job.
 */
export async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiFetch<JobStatusResponse>(`/api/jobs/${jobId}`);
}

/**
 * Fetches paginated segments for a job.
 */
export async function fetchJobSegments(
  jobId: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedSegmentsResponse> {
  return apiFetch<PaginatedSegmentsResponse>(`/api/jobs/${jobId}/segments?page=${page}&limit=${limit}`);
}

/**
 * Returns the download URL for a generated transcript file (.txt or .srt).
 */
export function getDownloadUrl(jobId: string, fileType: 'txt' | 'srt'): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  return `${baseUrl}/api/download/${jobId}/${fileType}`;
}

/**
 * Sends a request to cancel an active transcription job.
 */
export async function cancelJob(jobId: string): Promise<{ message: string; status: string }> {
  return apiFetch<{ message: string; status: string }>(`/api/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
}
