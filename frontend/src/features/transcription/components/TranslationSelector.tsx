import React, { useState, useEffect } from 'react';
import { getTranslationLanguages, translateTranscript } from '../../../services/apiClient';
import { LanguageOption, EngineOption, TranslationResponse, TranscriptSegment } from '../../../types';

interface TranslationSelectorProps {
  jobId: string;
  segments?: TranscriptSegment[];
  sourceLanguage?: string;
  onTranslationSuccess: (response: TranslationResponse) => void;
  onTranslationClear?: () => void;
  isTranslating: boolean;
  setIsTranslating: (val: boolean) => void;
  activeTranslation: TranslationResponse | null;
}

export const TranslationSelector: React.FC<TranslationSelectorProps> = ({
  jobId,
  segments,
  sourceLanguage,
  onTranslationSuccess,
  onTranslationClear,
  isTranslating,
  setIsTranslating,
  activeTranslation,
}) => {
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [engines, setEngines] = useState<EngineOption[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>('ES');
  const [selectedEngine, setSelectedEngine] = useState<string>('auto');
  const [error, setError] = useState<string | null>(null);

  const refreshData = () => {
    getTranslationLanguages()
      .then((data) => {
        setLanguages(data.languages);
        setEngines(data.engines);
      })
      .catch((err) => {
        console.error('Failed to load supported translation languages:', err);
      });
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleTranslate = async () => {
    if (!jobId || isTranslating) return;
    setIsTranslating(true);
    setError(null);

    try {
      const res = await translateTranscript(jobId, selectedLang, selectedEngine, segments, sourceLanguage);
      onTranslationSuccess(res);
      refreshData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  };

  const deeplEngine = engines.find((e) => e.id === 'deepl');
  const deeplUsage = deeplEngine?.usage;

  return (
    <div className="bg-[#181614]/80 backdrop-blur-md border border-[#2b2823] rounded-2xl p-5 mb-6 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#c8864a]/15 text-[#e6b88a] rounded-xl border border-[#c8864a]/30">
            <svg className="w-5 h-5 text-[#c8864a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#fceade]">Transcript Translation</h3>
            <p className="text-xs text-[#a39b91]">Translate output into target languages post-transcription</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#a39b91]">Language:</label>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              disabled={isTranslating}
              className="bg-[#0d0c0a] text-[#e6e2dd] text-xs rounded-xl px-3 py-2 border border-[#2b2823] focus:outline-none focus:border-[#c8864a] transition-colors cursor-pointer"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#a39b91]">Engine:</label>
            <select
              value={selectedEngine}
              onChange={(e) => setSelectedEngine(e.target.value)}
              disabled={isTranslating}
              className="bg-[#0d0c0a] text-[#e6e2dd] text-xs rounded-xl px-3 py-2 border border-[#2b2823] focus:outline-none focus:border-[#c8864a] transition-colors cursor-pointer"
            >
              {engines.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name} {eng.status === 'unconfigured' ? '(Unconfigured)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {deeplUsage && (selectedEngine === 'deepl' || selectedEngine === 'auto') && (
        <div className="mt-3.5 pt-3 border-t border-[#2b2823]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 text-[#e6b88a] flex-wrap">
            <span className="px-2.5 py-0.5 rounded-lg bg-[#c8864a]/15 border border-[#c8864a]/30 text-[#e6b88a] font-semibold text-[11px]">
              💳 DeepL Free Quota
            </span>
            <span className="text-[#e6e2dd] font-mono">
              {deeplUsage.remaining_characters.toLocaleString()} / {deeplUsage.character_limit.toLocaleString()} chars remaining
            </span>
            <span className="text-[#a39b91]">({deeplUsage.percent_remaining}% left)</span>
          </div>

          <div className="w-full sm:w-36 bg-[#0d0c0a] h-2 rounded-full border border-[#2b2823] overflow-hidden shrink-0">
            <div
              className={`h-full transition-all duration-500 ${
                deeplUsage.percent_remaining < 10
                  ? 'bg-rose-500'
                  : deeplUsage.percent_remaining < 30
                  ? 'bg-amber-400'
                  : 'bg-[#c8864a]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, deeplUsage.percent_remaining))}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 pt-1 flex justify-center">
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className="flex items-center justify-center gap-2 px-6 py-2.5 gold-gradient-btn text-white font-semibold text-xs rounded-xl transition-all shadow-lg shadow-[#c8864a]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
        >
          {isTranslating ? (
            <>
              <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Translating...</span>
            </>
          ) : (
            <span>Translate Now</span>
          )}
        </button>
      </div>

      {activeTranslation && (
        <div className="mt-3.5 pt-3.5 border-t border-[#2b2823]/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#e6b88a]">
            <span className="w-2 h-2 rounded-full bg-[#c8864a] animate-pulse"></span>
            <span>
              Translated to <strong className="text-[#fceade]">{activeTranslation.target_language_name}</strong> via{' '}
              <strong className="text-[#c8864a]">{activeTranslation.engine_used}</strong>
            </span>
          </div>
          {onTranslationClear && (
            <button
              onClick={onTranslationClear}
              className="text-[#a39b91] hover:text-[#e6e2dd] transition-colors text-xs font-medium cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
          {error}
        </div>
      )}
    </div>
  );
};
