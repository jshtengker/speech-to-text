import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { FileUploader } from '@/features/upload/components/FileUploader';
import { LiveStreamViewer } from '@/features/transcription/components/LiveStreamViewer';
import { TranscriptView } from '@/features/transcription/components/TranscriptView';
import { TranscribeResponse } from '@/types';
import { Sparkles, Cpu, ShieldCheck } from 'lucide-react';

export function App() {
  const [activeJob, setActiveJob] = useState<TranscribeResponse | null>(null);
  const [jobCompleted, setJobCompleted] = useState<boolean>(false);
  const [jobCancelled, setJobCancelled] = useState<boolean>(false);

  const handleJobStarted = (job: TranscribeResponse) => {
    setActiveJob(job);
    setJobCompleted(false);
    setJobCancelled(false);
  };

  const handleJobCompleted = () => {
    setJobCompleted(true);
  };

  const handleJobCancelled = () => {
    setJobCancelled(true);
  };

  const isProcessing = activeJob !== null && !jobCompleted && !jobCancelled;

  return (
    <div className="min-h-screen flex flex-col bg-raycast-obsidian text-[#e6e2dd] selection:bg-[#c8864a]/30 selection:text-[#c8864a] relative overflow-hidden">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pb-20 space-y-8 animate-fade-in relative z-10">
        {!activeJob && (
          <div className="text-center py-6 space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#c8864a]/10 border border-[#c8864a]/25 text-xs font-semibold text-[#e6b88a] shadow-sm shadow-[#c8864a]/10">
              <Sparkles className="w-3.5 h-3.5 text-[#c8864a]" />
              <span>Faster-Whisper Engine • Studio Quality</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight gold-gradient-text leading-tight">
              Transform Audio & Video into Precise Subtitles
            </h2>
            <p className="text-xs sm:text-sm text-[#a39b91] leading-relaxed">
              Upload high-definition recordings. Faster-Whisper processes your media directly on local hardware, generating synchronized SRT and plain text transcripts.
            </p>
          </div>
        )}

        <FileUploader onJobStarted={handleJobStarted} disabled={isProcessing} />

        {activeJob && (
          <LiveStreamViewer
            key={activeJob.job_id}
            jobId={activeJob.job_id}
            filename={activeJob.filename}
            onCompleted={handleJobCompleted}
            onCancelled={handleJobCancelled}
          />
        )}

        {activeJob && jobCompleted && (
          <TranscriptView jobId={activeJob.job_id} />
        )}
      </main>

      <footer className="border-t border-[#2b2823] py-6 px-6 text-center text-xs text-[#a39b91] bg-[#181614]/50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#e6b88a]">
            <Cpu className="w-4 h-4 text-[#c8864a]" />
            <span className="font-medium">Local Hardware Acceleration</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>© {new Date().getFullYear()} Whisper Studio • 100% Offline Processing</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
