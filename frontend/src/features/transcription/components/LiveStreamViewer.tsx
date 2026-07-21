import React, { useState, useEffect, useRef } from 'react';
import { Activity, Clock, AlertTriangle, Globe, Radio, Download, XCircle, Cpu } from 'lucide-react';
import { useTranscriptionStream } from '../hooks/useTranscriptionStream';
import { cancelJob } from '../api/transcriptionApi';

interface LiveStreamViewerProps {
  jobId: string;
  filename: string;
  onCompleted: () => void;
  onCancelled?: () => void;
}

export const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({ jobId, filename, onCompleted, onCancelled }) => {
  const { segments, status, isDownloading, languageInfo, executionTime, errorMsg } = useTranscriptionStream(jobId, onCompleted);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, autoScroll]);

  useEffect(() => {
    if (status === 'cancelled' && onCancelled) {
      onCancelled();
    }
  }, [status, onCancelled]);

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
      await cancelJob(jobId);
      if (onCancelled) onCancelled();
    } catch (err) {
      console.error('Failed to cancel job:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const isCanCancel = status === 'processing' || status === 'loading_model' || status === 'pending';

  return (
    <div className="glass-panel rounded-2xl p-6 border border-[#2b2823] shadow-2xl mb-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#2b2823]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c8864a]/10 text-[#c8864a] flex items-center justify-center border border-[#c8864a]/30 shrink-0 shadow-sm shadow-[#c8864a]/10">
            <Radio className="w-5 h-5 animate-pulse text-[#c8864a]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#fceade] truncate max-w-xs sm:max-w-md">{filename}</h3>
              <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                status === 'completed' 
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                  : status === 'loading_model'
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 animate-pulse'
                  : status === 'cancelled'
                  ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                  : status === 'failed'
                  ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                  : 'bg-[#c8864a]/15 text-[#e6b88a] border border-[#c8864a]/30 animate-pulse'
              }`}>
                {status === 'loading_model' ? (isDownloading ? 'Downloading Model' : 'Loading Model') : status}
              </span>
            </div>
            <p className="text-xs text-[#a39b91]">Real-time transcription stream</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {languageInfo && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#201e1b] border border-[#2b2823] text-[#a39b91]">
              <Globe className="w-3.5 h-3.5 text-[#c8864a]" />
              <span>Lang: <strong className="text-[#fceade]">{languageInfo.language}</strong> ({(languageInfo.probability * 100).toFixed(0)}%)</span>
            </div>
          )}

          {executionTime !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Processed in {executionTime}s</span>
            </div>
          )}

          {isCanCancel && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{isCancelling ? 'Cancelling...' : 'Cancel'}</span>
            </button>
          )}

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer ${
              autoScroll ? 'bg-[#c8864a]/20 border-[#c8864a]/40 text-[#e6b88a]' : 'bg-[#201e1b] border-[#2b2823] text-[#a39b91]'
            }`}
          >
            Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-72 overflow-y-auto bg-[#0d0c0a] rounded-xl p-4 border border-[#2b2823] font-mono text-xs space-y-2.5"
      >
        {status === 'cancelled' ? (
          <div className="h-full flex flex-col items-center justify-center text-[#a39b91] gap-2 animate-fade-in">
            <XCircle className="w-8 h-8 text-rose-400 mb-1" />
            <p className="text-xs text-rose-300 font-bold">Cancelled</p>
            <p className="text-[11px] text-[#a39b91]">Transcription processing was stopped by user request.</p>
          </div>
        ) : segments.length === 0 && !errorMsg ? (
          status === 'loading_model' ? (
            isDownloading ? (
              <div className="h-full flex flex-col items-center justify-center text-[#a39b91] gap-3 animate-fade-in">
                <Download className="w-6 h-6 animate-bounce text-amber-400" />
                <p className="text-xs text-amber-200 font-semibold">Downloading AI Model weights from HuggingFace...</p>
                <p className="text-[11px] text-[#a39b91]">Uncached models are downloaded automatically on first use</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#a39b91] gap-3 animate-fade-in">
                <Cpu className="w-6 h-6 animate-pulse text-amber-400" />
                <p className="text-xs text-amber-200 font-semibold">Loading AI Model into GPU memory...</p>
                <p className="text-[11px] text-[#a39b91]">Initializing neural network weights</p>
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#a39b91] gap-3">
              <Activity className="w-6 h-6 animate-spin text-[#c8864a]" />
              <p className="text-xs">Initializing Faster-Whisper neural pipeline and VAD filter...</p>
            </div>
          )
        ) : (
          segments.map((seg) => (
            <div key={seg.index} className="flex items-start gap-3 hover:bg-[#181614] p-2 rounded-lg transition-colors group border border-transparent hover:border-[#2b2823]">
              <span className="px-2 py-0.5 rounded-md bg-[#201e1b] text-[#c8864a] text-[10px] font-mono border border-[#2b2823] shrink-0 font-medium">
                [{seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s]
              </span>
              <span className="text-[#e6e2dd] group-hover:text-white transition-colors leading-relaxed">{seg.text}</span>
            </div>
          ))
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Error: {errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
