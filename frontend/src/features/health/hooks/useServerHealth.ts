import { useState, useEffect, useCallback } from 'react';
import { HealthStatusResponse } from '@/types';
import { fetchHealth } from '../api/fetchHealth';

export function useServerHealth(pollIntervalMs: number = 15000) {
  const [health, setHealth] = useState<HealthStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHealth();
      setHealth(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, pollIntervalMs]);

  return { health, loading, error, refetch: checkHealth };
}
