import React from 'react';
import { Mic, Cpu, Zap, RefreshCw, ServerOff } from 'lucide-react';
import { useServerHealth } from '@/features/health/hooks/useServerHealth';

export const Header: React.FC = () => {
  const { health, loading, error, refetch } = useServerHealth(15000);

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-[#2b2823] px-6 py-4 mb-8 transition-all">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-[#9a6a38] to-[#c8864a] flex items-center justify-center text-white shadow-lg shadow-[#c8864a]/25 border border-[#c8864a]/40 shrink-0">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-[#fceade]">
                Speech-To-Text
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-full bg-[#c8864a]/15 text-[#e6b88a] border border-[#c8864a]/30">
                Faster-Whisper
              </span>
            </div>
            <p className="text-xs text-[#a39b91]">Generate Transcription from video or music files.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loading && !health ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#201e1b] border border-[#2b2823] text-xs text-[#a39b91]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#c8864a]" />
              <span>Connecting to engine...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300">
              <ServerOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Backend Server Offline</span>
              <button 
                onClick={refetch} 
                className="ml-1 p-1 hover:bg-rose-900/50 rounded-md transition-colors"
                title="Retry connection"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          ) : health?.cuda_available || health?.device === 'cuda' ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs font-medium text-emerald-300 shadow-sm shadow-emerald-950/40">
              <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>GPU Acceleration Active</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs font-medium text-amber-300">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>CPU Execution Mode</span>
            </div>
          )}

          <button
            onClick={refetch}
            disabled={loading}
            className="p-2 text-[#a39b91] hover:text-[#fceade] hover:bg-[#201e1b] rounded-xl transition-colors border border-transparent hover:border-[#2b2823]"
            title="Refresh Engine Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#c8864a]' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
