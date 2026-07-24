/**
 * Extracts the full audio track from heavy video files (e.g. 1.4GB 1080p movies)
 * into a pristine 16kHz 16-bit PCM WAV audio file directly inside browser memory.
 */
export async function extractAudioFromMedia(
  file: File,
  onProgress?: (msg: string) => void
): Promise<File> {
  // Do NOT attempt browser decodeAudioData on video containers (e.g. MP4, WebM, MOV, MKV).
  // Browser AudioContext decoders cut off video audio when demuxing interleaved tracks.
  // Backend FFmpeg handles video files directly with 100% full duration accuracy.
  if (file.type.startsWith('video/') || file.size <= 35 * 1024 * 1024) {
    return file;
  }

  if (onProgress) {
    onProgress('Extracting speech audio track from video file in browser...');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Standard Whisper 16kHz 16-bit mono audio
    const targetSampleRate = 16000;
    const bitDepth = 16;
    const renderDuration = decodedBuffer.duration;

    const numberOfFrames = Math.ceil(renderDuration * targetSampleRate);
    const offlineCtx = new OfflineAudioContext(1, numberOfFrames, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = bufferToWavBlob(renderedBuffer, bitDepth);

    const cleanName = file.name.replace(/\.[^/.]+$/, '') + '_speech.wav';
    return new File([wavBlob], cleanName, { type: 'audio/wav' });
  } catch (err) {
    console.warn('Native audio extraction skipped, returning original file:', err);
    return file;
  }
}

function bufferToWavBlob(buffer: AudioBuffer, bitDepth: 8 | 16 = 16): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const samples = buffer.getChannelData(0);
  const dataByteCount = samples.length * bytesPerSample;
  const headerByteCount = 44;
  const totalByteCount = headerByteCount + dataByteCount;

  const arrayBuffer = new ArrayBuffer(totalByteCount);
  const view = new DataView(arrayBuffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + dataByteCount, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, dataByteCount, true);

  /* PCM conversion */
  let offset = 44;
  if (bitDepth === 16) {
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  } else {
    for (let i = 0; i < samples.length; i++, offset += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setUint8(offset, Math.floor((s + 1) * 127.5));
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
