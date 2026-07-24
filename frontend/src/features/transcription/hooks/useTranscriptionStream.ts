import { useState, useEffect } from 'react';
import { TranscribeResponse, TranscriptSegment } from '@/types';

export function useTranscriptionStream(
  jobId: string,
  onCompleted?: () => void,
  initialJob?: TranscribeResponse | null
) {
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialJob?.segments || []);
  const [status, setStatus] = useState<'pending' | 'loading_model' | 'processing' | 'completed' | 'failed' | 'cancelled'>(
    (initialJob?.status as 'pending' | 'loading_model' | 'processing' | 'completed' | 'failed' | 'cancelled') || 'processing'
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [languageInfo, setLanguageInfo] = useState<{ language: string; probability: number } | null>(
    initialJob?.language ? { language: initialJob.language, probability: 1.0 } : null
  );
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

    // Check REST status immediately for completed synchronous jobs
    fetch(`${baseUrl}/api/jobs/${jobId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!isMounted || !data) return;
        if (data.status === 'completed' || data.status === 'failed') {
          setStatus(data.status);
          if (data.execution_time) setExecutionTime(data.execution_time);
          if (data.error) setErrorMsg(data.error);
          if (data.status === 'completed') {
            fetch(`${baseUrl}/api/jobs/${jobId}/segments?page=1&limit=500`)
              .then(res => res.ok ? res.json() : null)
              .then(segData => {
                if (isMounted && segData?.segments) {
                  setSegments(segData.segments);
                }
              })
              .catch(() => {});
            if (onCompleted) onCompleted();
          }
        }
      })
      .catch(() => {});

    const eventSource = new EventSource(`${baseUrl}/api/jobs/${jobId}/stream`);

    eventSource.addEventListener('status', (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (data.status) {
        setStatus(data.status);
        if (data.is_downloading !== undefined) {
          setIsDownloading(Boolean(data.is_downloading));
        }
        if (data.status === 'cancelled') {
          eventSource.close();
        }
      }
    });

    eventSource.addEventListener('info', (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLanguageInfo({
        language: data.language,
        probability: data.language_probability,
      });
    });

    eventSource.addEventListener('segment', (e: Event) => {
      const seg: TranscriptSegment = JSON.parse((e as MessageEvent).data);
      setSegments((prev: TranscriptSegment[]) => [...prev, seg]);
    });

    eventSource.addEventListener('complete', (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data);
      setStatus('completed');
      if (data.execution_time) setExecutionTime(data.execution_time);
      eventSource.close();
      if (onCompleted) onCompleted();
    });

    eventSource.onerror = () => {
      eventSource.close();
      // On SSE disconnect/error, fetch final REST state
      fetch(`${baseUrl}/api/jobs/${jobId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!isMounted || !data) return;
          setStatus(data.status || 'completed');
          if (data.error) setErrorMsg(data.error);
          if (data.status === 'completed' && onCompleted) onCompleted();
        })
        .catch(() => {});
    };

    return () => {
      isMounted = false;
      eventSource.close();
    };
  }, [jobId, onCompleted]);

  return {
    segments,
    status,
    isDownloading,
    languageInfo,
    executionTime,
    errorMsg,
  };
}
