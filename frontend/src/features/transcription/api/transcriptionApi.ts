import { apiFetch } from '@/services/apiClient';
import { JobStatusResponse, PaginatedSegmentsResponse } from '@/types';

export async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiFetch<JobStatusResponse>(`/api/jobs/${jobId}`);
}

export async function fetchJobSegments(
  jobId: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedSegmentsResponse> {
  return apiFetch<PaginatedSegmentsResponse>(`/api/jobs/${jobId}/segments?page=${page}&limit=${limit}`);
}

export function getDownloadUrl(jobId: string, fileType: 'txt' | 'srt', lang?: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const langQuery = lang && lang.trim() ? `?lang=${encodeURIComponent(lang.trim().toUpperCase())}` : '';
  return `${baseUrl}/api/download/${jobId}/${fileType}${langQuery}`;
}

export async function cancelJob(jobId: string): Promise<{ message: string; status: string }> {
  return apiFetch<{ message: string; status: string }>(`/api/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
}

