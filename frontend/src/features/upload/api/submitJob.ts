import { TranscribeOptions, TranscribeResponse } from '@/types';

export async function submitTranscriptionJob(
  file: File,
  options: TranscribeOptions = {}
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  if (options.model) {
    formData.append('model', options.model);
  }
  if (options.language) {
    formData.append('language', options.language);
  }
  if (options.vadFilter !== undefined) {
    formData.append('vad_filter', options.vadFilter.toString());
  }
  if (options.beamSize !== undefined) {
    formData.append('beam_size', options.beamSize.toString());
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const res = await fetch(`${baseUrl}/api/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to submit transcription job' }));
    throw new Error(errorData.detail || 'Upload failed');
  }

  return res.json();
}
