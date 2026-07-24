/**
 * Extracts the full audio track from heavy video files (e.g. 1.4GB 1080p movies)
 * into a pristine 16kHz 16-bit PCM WAV audio file directly inside browser memory.
 */
export async function extractAudioFromMedia(
  file: File,
  onProgress?: (msg: string) => void
): Promise<File> {
  // If the file is under 45 MB, pass directly (fits within Supabase Storage 50 MB limit)
  if (file.size <= 45 * 1024 * 1024) {
    return file;
  }

  if (onProgress) {
    onProgress('Extracting & compressing speech audio track from heavy media file...');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Try compressed Opus/WebM encoding first via MediaRecorder for ultra-small file size (~15MB for full movie)
    try {
      const mimeType = (typeof MediaRecorder !== 'undefined') && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (typeof MediaRecorder !== 'undefined') && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : (typeof MediaRecorder !== 'undefined') && MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : '';

      if (mimeType) {
        const dest = audioCtx.createMediaStreamDestination();
        const source = audioCtx.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(dest);

        const recorder = new MediaRecorder(dest.stream, {
          mimeType,
          audioBitsPerSecond: 32000 // 32 kbps Mono speech stream (~15MB for a 1.5 hr movie)
        });

        const chunks: Blob[] = [];
        const recordingPromise = new Promise<Blob>((resolve, reject) => {
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
          recorder.onerror = (e) => reject(e);
        });

        recorder.start(100);
        source.start(0);

        source.onended = () => {
          recorder.stop();
        };

        const compressedBlob = await recordingPromise;
        await audioCtx.close().catch(() => {});

        if (compressedBlob.size > 0 && compressedBlob.size < file.size) {
          const ext = mimeType.includes('ogg') ? '.ogg' : '.webm';
          const cleanName = file.name.replace(/\.[^/.]+$/, '') + `_compressed${ext}`;
          return new File([compressedBlob], cleanName, { type: mimeType });
        }
      }
    } catch (recorderErr) {
      console.warn('Compressed MediaRecorder extraction fallback:', recorderErr);
    }

    // Fallback: Standard Whisper 16kHz mono WAV audio
    const targetSampleRate = 16000;
    const renderDuration = decodedBuffer.duration;
    const numberOfFrames = Math.ceil(renderDuration * targetSampleRate);
    const offlineCtx = new OfflineAudioContext(1, numberOfFrames, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    await audioCtx.close().catch(() => {});

    // Use 8-bit PCM if estimated 16-bit size exceeds 45 MB
    const estimated16BitSize = numberOfFrames * 2 + 44;
    const bitDepth = estimated16BitSize > 45 * 1024 * 1024 ? 8 : 16;
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
