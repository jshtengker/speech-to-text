import { useState, useEffect } from 'react';
import { TranscriptSegment } from '@/types';

export function useTranscriptionStream(jobId: string, onCompleted?: () => void) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [status, setStatus] = useState<'pending' | 'loading_model' | 'processing' | 'completed' | 'failed' | 'cancelled'>('processing');
  const [isDownloading, setIsDownloading] = useState(false);
  const [languageInfo, setLanguageInfo] = useState<{ language: string; probability: number } | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
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
      setSegments((prev) => [...prev, seg]);
    });

    eventSource.addEventListener('complete', (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data);
      setStatus('completed');
      if (data.execution_time) setExecutionTime(data.execution_time);
      eventSource.close();
      if (onCompleted) onCompleted();
    });

    eventSource.addEventListener('error', (e: Event) => {
      const msgEvent = e as MessageEvent;
      if (msgEvent.data) {
        try {
          const data = JSON.parse(msgEvent.data);
          setErrorMsg(data.error || 'Transcription stream error');
        } catch {
          /* ignore */
        }
      }
    });

    return () => {
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
