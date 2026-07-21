export interface WhisperModel {
  id: string;
  name: string;
  vram: string;
}

export const WHISPER_MODELS: WhisperModel[] = [
  { id: 'turbo', name: 'Turbo (Recommended)', vram: '~1.8 GB VRAM' },
  { id: 'large-v3', name: 'Large v3', vram: '~3.0 GB VRAM' },
  { id: 'medium', name: 'Medium', vram: '~1.5 GB VRAM' },
  { id: 'small', name: 'Small', vram: '~0.8 GB VRAM' },
  { id: 'base', name: 'Base', vram: '~0.4 GB VRAM' },
  { id: 'tiny', name: 'Tiny', vram: '~0.2 GB VRAM' },
];
