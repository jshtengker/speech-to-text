import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, FileVideo, Settings2, AlertCircle, Play, X, Zap } from 'lucide-react';
import { TranscribeResponse } from '@/types';
import { LANGUAGES } from '../constants/languages';
import { WHISPER_MODELS, WhisperModel } from '../constants/models';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, ACCEPT_FILE_TYPES } from '../constants/files';
import { submitTranscriptionJob } from '../api/submitJob';
import { fetchSupportedModels } from '@/services/apiClient';

interface FileUploaderProps {
  onJobStarted: (job: TranscribeResponse) => void;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onJobStarted, disabled }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [availableModels, setAvailableModels] = useState<WhisperModel[]>(WHISPER_MODELS);
  const [model, setModel] = useState('turbo');
  const [groqConfigured, setGroqConfigured] = useState<boolean>(false);
  const [language, setLanguage] = useState('');
  const [vadFilter, setVadFilter] = useState(true);
  const [beamSize, setBeamSize] = useState(5);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchSupportedModels()
      .then((data) => {
        if (!isMounted || !data.models || data.models.length === 0) return;
        const formatted: WhisperModel[] = data.models.map((m) => ({
          id: m.id,
          name: m.name,
          vram: m.vram,
          description: m.description,
          default: m.default,
          is_cloud: m.is_cloud,
        }));
        setAvailableModels(formatted);
        if (data.groq_configured !== undefined) {
          setGroqConfigured(data.groq_configured);
        }
        const defaultModel = formatted.find((m) => m.default) || formatted[0];
        if (defaultModel) {
          setModel(defaultModel.id);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch supported models from backend, using fallback:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setUploadError(null);
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setSelectedFile(null);
      setUploadError(`Unsupported file format (${ext}). Supported formats: ${ALLOWED_EXTENSIONS.join(', ')}.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setUploadError(`File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of 2 GB.`);
      return;
    }

    setSelectedFile(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleStartTranscription = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const data = await submitTranscriptionJob(selectedFile, {
        model,
        language: language || undefined,
        vadFilter,
        beamSize,
      });
      onJobStarted(data);
    } catch (err: unknown) {
      setUploadError((err as Error).message || 'Error submitting transcription job');
    } finally {
      setIsUploading(false);
    }
  };

  const isVideo = selectedFile?.type.startsWith('video/');

  const handleDischargeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-[#2b2823] transition-all duration-300">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#fceade] flex items-center gap-2">
            Upload Media Recording
          </h2>
          <p className="text-xs text-[#a39b91]">Select an audio or video file to process with Faster-Whisper</p>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
            showSettings
              ? 'bg-[#c8864a]/20 text-[#e6b88a] border-[#c8864a]/50 shadow-sm shadow-[#c8864a]/10'
              : 'bg-[#201e1b] text-[#a39b91] border-[#2b2823] hover:text-[#e6e2dd] hover:border-[#c8864a]/30'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Engine Parameters</span>
        </button>
      </div>

      {showSettings && (
        <div className="mb-6 p-4 rounded-xl bg-[#181614]/90 border border-[#2b2823] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs animate-fade-in">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[#e6e2dd] font-medium">AI Whisper Model</label>
              {model === 'groq-large-v3' && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  groqConfigured 
                    ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' 
                    : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                }`}>
                  <Zap className="w-3 h-3" />
                  {groqConfigured ? 'Groq Active' : 'Cloud Engine'}
                </span>
              )}
            </div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#0d0c0a] border border-[#2b2823] rounded-xl px-3 py-2 text-[#e6e2dd] focus:outline-none focus:border-[#c8864a] transition-colors cursor-pointer"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.vram})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[#e6e2dd] font-medium mb-1.5">Target Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-[#0d0c0a] border border-[#2b2823] rounded-xl px-3 py-2 text-[#e6e2dd] focus:outline-none focus:border-[#c8864a] transition-colors cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[#e6e2dd] font-medium mb-1.5">Voice Activity Filter (VAD)</label>
            <button
              type="button"
              onClick={() => setVadFilter(!vadFilter)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                vadFilter
                  ? 'bg-[#c8864a]/15 border-[#c8864a]/40 text-[#e6b88a]'
                  : 'bg-[#0d0c0a] border-[#2b2823] text-[#a39b91]'
              }`}
            >
              <span>Filter Silence & Noise</span>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${vadFilter ? 'bg-[#c8864a] text-[#0d0c0a]' : 'bg-[#2b2823] text-[#a39b91]'}`}>
                {vadFilter ? '✓' : '✕'}
              </span>
            </button>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[#e6e2dd] font-medium">Beam Size ({beamSize})</label>
              <span className="text-[10px] text-[#a39b91]">Higher = More precise</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={beamSize}
              onChange={(e) => setBeamSize(Number(e.target.value))}
              className="w-full accent-[#c8864a] bg-[#0d0c0a] cursor-pointer h-2 rounded-lg"
            />
          </div>
        </div>
      )}

      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${
          dragActive
            ? 'border-[#c8864a] bg-[#c8864a]/10 scale-[1.01]'
            : selectedFile
            ? 'border-[#c8864a]/40 bg-[#201e1b]/80'
            : 'border-[#2b2823] hover:border-[#c8864a]/40 bg-[#181614]/40 hover:bg-[#181614]/80'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_FILE_TYPES}
          onChange={handleChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center animate-fade-in relative pt-1">
            <button
              type="button"
              onClick={handleDischargeFile}
              className="absolute -top-4 -right-4 p-2 rounded-full bg-[#201e1b] border border-[#2b2823] text-[#a39b91] hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all cursor-pointer shadow-lg group/x"
              title="Discharge selected file"
            >
              <X className="w-4 h-4 transition-transform group-hover/x:scale-110" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-[#c8864a]/15 text-[#c8864a] flex items-center justify-center mb-3 border border-[#c8864a]/30 shadow-md shadow-[#c8864a]/10">
              {isVideo ? <FileVideo className="w-7 h-7" /> : <FileAudio className="w-7 h-7" />}
            </div>
            <p className="text-sm font-bold text-[#fceade] mb-1 truncate max-w-md">{selectedFile.name}</p>
            <p className="text-xs text-[#a39b91] mb-3">{formatFileSize(selectedFile.size)} • {selectedFile.type || 'Media File'}</p>
            
            <button
              type="button"
              onClick={handleDischargeFile}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 hover:bg-rose-500/20 transition-all font-medium cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>Discharge / Choose a different file</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-[#c8864a]/10 text-[#c8864a] flex items-center justify-center mb-3 border border-[#c8864a]/20 shadow-sm">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-[#e6e2dd] mb-1">
              Drag & drop your audio or video file here
            </p>
            <p className="text-xs text-[#a39b91] mb-4">
              Supports MP3, WAV, M4A, FLAC, MP4, MKV, WEBM, MOV (Max 2GB)
            </p>
            <span className="inline-block px-4 py-1.5 rounded-xl bg-[#c8864a]/15 text-[#e6b88a] border border-[#c8864a]/30 text-xs font-semibold shadow-sm">
              Browse Files
            </span>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {selectedFile && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleStartTranscription}
            disabled={isUploading || disabled}
            className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              isUploading
                ? 'bg-[#201e1b] text-[#a39b91] cursor-not-allowed border border-[#2b2823]'
                : 'gold-gradient-btn text-white shadow-[#c8864a]/20 active:scale-[0.98]'
            }`}
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-[#a39b91] border-t-transparent rounded-full animate-spin" />
                <span>Uploading Media to Engine...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Start Transcription</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
