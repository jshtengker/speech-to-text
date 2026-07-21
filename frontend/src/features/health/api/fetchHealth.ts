import { apiFetch } from '@/services/apiClient';
import { HealthStatusResponse } from '@/types';

/**
 * Checks system health, GPU status, and active job count.
 */
export async function fetchHealth(): Promise<HealthStatusResponse> {
  return apiFetch<HealthStatusResponse>('/api/health');
}
