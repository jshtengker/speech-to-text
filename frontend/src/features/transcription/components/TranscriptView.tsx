import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, Search, FileText, Subtitles, ChevronLeft, ChevronRight } from 'lucide-react';
import { TranscriptSegment, JobStatusResponse } from '@/types';
import { fetchJobStatus, fetchJobSegments, getDownloadUrl } from '../api/transcriptionApi';

interface TranscriptViewProps {
  jobId: string;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({ jobId }) => {
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeTab, setActiveTab] = useState<'txt' | 'srt'>('txt');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobStatus(jobId)
      .then((data) => setJobStatus(data))
      .catch((err) => console.error('Failed to fetch job metadata:', err));
  }, [jobId]);

  useEffect(() => {
    setLoading(true);
    fetchJobSegments(jobId, page, 50)
      .then((data) => {
        setSegments(data.segments);
        setTotalPages(data.total_pages);
        setTotalItems(data.total_items);
      })
      .catch((err) => console.error('Failed to fetch segments:', err))
      .finally(() => setLoading(false));
  }, [jobId, page]);

  const filteredSegments = segments.filter((seg) =>
    seg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds - Math.floor(seconds)) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
  };

  const getSrtText = () => {
    return filteredSegments
      .map(
        (seg) =>
          `${seg.index}\n${formatTimestamp(seg.start)} --> ${formatTimestamp(seg.end)}\n${seg.text}\n`
      )
      .join('\n');
  };

  const getPlainText = () => {
    return filteredSegments
      .map((seg) => `[${seg.start.toFixed(2)}s -> ${seg.end.toFixed(2)}s] ${seg.text}`)
      .join('\n');
  };

  const handleCopy = () => {
    const textToCopy = activeTab === 'srt' ? getSrtText() : getPlainText();
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (fileType: 'txt' | 'srt') => {
    const downloadUrl = getDownloadUrl(jobId, fileType);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${jobStatus?.filename || 'transcript'}.${fileType}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-[#2b2823] shadow-2xl animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#fceade] flex items-center gap-2">
              Transcript Explorer
            </h2>
            {jobStatus?.model && (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[#c8864a]/15 text-[#e6b88a] border border-[#c8864a]/30">
                {jobStatus.model}
              </span>
            )}
          </div>
          <p className="text-xs text-[#a39b91]">
            Total Transcribed Segments: <strong className="text-[#e6b88a]">{totalItems}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-[#181614] p-1 rounded-xl border border-[#2b2823] flex items-center gap-1">
            <button
              onClick={() => setActiveTab('txt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'txt'
                  ? 'gold-gradient-btn text-white shadow-md shadow-[#c8864a]/20'
                  : 'text-[#a39b91] hover:text-[#e6e2dd]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Plain Text (.txt)</span>
            </button>
            <button
              onClick={() => setActiveTab('srt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'srt'
                  ? 'gold-gradient-btn text-white shadow-md shadow-[#c8864a]/20'
                  : 'text-[#a39b91] hover:text-[#e6e2dd]'
              }`}
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span>Subtitles (.srt)</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#201e1b] border border-[#2b2823] text-xs font-medium text-[#e6e2dd] hover:bg-[#2b2823] hover:text-white transition-all cursor-pointer"
            title="Copy current page to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={() => handleDownload('txt')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#c8864a]/15 border border-[#c8864a]/30 text-xs font-semibold text-[#e6b88a] hover:bg-[#c8864a]/25 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#c8864a]" />
            <span>.TXT</span>
          </button>

          <button
            onClick={() => handleDownload('srt')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#9a6a38]/20 border border-[#9a6a38]/40 text-xs font-semibold text-[#e6b88a] hover:bg-[#9a6a38]/30 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#9a6a38]" />
            <span>.SRT</span>
          </button>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a39b91]" />
        <input
          type="text"
          placeholder="Search keywords in transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#0d0c0a] border border-[#2b2823] rounded-xl text-xs text-[#e6e2dd] placeholder-[#a39b91] focus:outline-none focus:border-[#c8864a] transition-colors"
        />
      </div>

      <div className="bg-[#0d0c0a] rounded-xl border border-[#2b2823] p-4 min-h-75 max-h-125 overflow-y-auto font-mono text-xs">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-[#a39b91]">
            <span>Loading segments...</span>
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-[#a39b91]">
            <span>No matching transcript lines found.</span>
          </div>
        ) : activeTab === 'srt' ? (
          <pre className="text-[#e6e2dd] whitespace-pre-wrap leading-relaxed">
            {getSrtText()}
          </pre>
        ) : (
          <div className="space-y-2">
            {filteredSegments.map((seg) => (
              <div
                key={seg.index}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#181614] transition-colors border border-transparent hover:border-[#2b2823]"
              >
                <span className="px-2 py-0.5 rounded bg-[#201e1b] border border-[#2b2823] text-[10px] text-[#c8864a] font-mono shrink-0 font-medium">
                  {seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s
                </span>
                <p className="text-[#e6e2dd] leading-relaxed">{seg.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2b2823] text-xs text-[#a39b91]">
          <span>
            Page <strong className="text-[#fceade]">{page}</strong> of <strong className="text-[#fceade]">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-xl bg-[#201e1b] border border-[#2b2823] hover:bg-[#2b2823] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[#e6e2dd] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-xl bg-[#201e1b] border border-[#2b2823] hover:bg-[#2b2823] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[#e6e2dd] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
