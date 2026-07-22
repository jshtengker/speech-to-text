import { apiFetch } from '@/services/apiClient';
import { HealthStatusResponse } from '@/types';

export async function fetchHealth(): Promise<HealthStatusResponse> {
  return apiFetch<HealthStatusResponse>('/api/health');
}
