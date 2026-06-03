import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ExternalLink, ClipboardPaste, ArrowRight } from 'lucide-react';

interface ScholarSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profileUrl: string) => void;
}

export function ScholarSearchModal({ isOpen, onClose, onSelect }: ScholarSearchModalProps) {
  const [pastedUrl, setPastedUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setPastedUrl('');
      setError(null);
    }
  }, [isOpen]);

  const openGoogleScholar = () => {
    window.open('https://scholar.google.com/citations?view_op=search_authors', '_blank');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = pastedUrl.trim();
    if (!url) return;

    if (url.includes('scholar.google.com/citations') && url.includes('user=')) {
      onSelect(url);
      onClose();
    } else {
      setError('Please paste a valid Google Scholar profile URL (should contain scholar.google.com/citations?user=...)');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scholar-search-title"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 id="scholar-search-title" className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <Search className="h-4 w-4 text-[#2d7d7d] mr-2" />
            Find Author on Google Scholar
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Steps */}
        <div className="p-5 space-y-5">
          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2d7d7d] text-white text-xs font-bold flex items-center justify-center mt-0.5">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                Search for the author on Google Scholar
              </p>
              <button
                onClick={openGoogleScholar}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2d7d7d] text-white text-sm font-medium rounded-lg hover:bg-[#236363] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Google Scholar
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2d7d7d] text-white text-xs font-bold flex items-center justify-center mt-0.5">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Click on the author's profile, then copy the URL from your browser
              </p>
              <p className="text-xs text-gray-400 mt-1">
                It should look like: scholar.google.com/citations?user=...
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2d7d7d] text-white text-xs font-bold flex items-center justify-center mt-0.5">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                Paste the profile URL here
              </p>
              <form onSubmit={handleSubmit}>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={pastedUrl}
                    onChange={(e) => { setPastedUrl(e.target.value); setError(null); }}
                    placeholder="https://scholar.google.com/citations?user=..."
                    className="w-full px-4 py-2.5 pl-10 pr-12 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-[#2d7d7d] focus:ring-2 focus:ring-[#2d7d7d]/20 focus:bg-white dark:focus:bg-gray-800 transition-all"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <ClipboardPaste className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  {pastedUrl.trim() && (
                    <button
                      type="submit"
                      className="absolute right-2 top-1.5 p-1.5 bg-[#2d7d7d] text-white rounded-md hover:bg-[#236363] transition-colors"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {error && (
                  <p className="text-xs text-red-500 mt-1.5">{error}</p>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
