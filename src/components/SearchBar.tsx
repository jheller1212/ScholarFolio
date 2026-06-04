import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, AlertCircle, BookOpen } from 'lucide-react';
import DOMPurify from 'dompurify';

interface SearchBarProps {
  onSearch: (url: string) => void;
  isLoading?: boolean;
  compact?: boolean;
  error?: string | null;
}

export function SearchBar({ onSearch, isLoading = false, compact = false, error: externalError }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const error = externalError || localError;

  // Progress bar
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const startTime = Date.now();
      const estimatedDuration = 8000;
      progressRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = 90 * (1 - Math.exp(-2.5 * elapsed / estimatedDuration));
        setProgress(Math.min(p, 90));
      }, 100);
    } else {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
      if (progress > 0) {
        setProgress(100);
        const timeout = setTimeout(() => setProgress(0), 500);
        return () => clearTimeout(timeout);
      }
    }
    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
    };
  }, [isLoading]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    setLocalError(null);

    if (!trimmed) {
      setLocalError('Please paste a Google Scholar profile URL');
      return;
    }

    const sanitized = DOMPurify.sanitize(trimmed);

    try {
      const urlObj = new URL(sanitized);

      if (!urlObj.hostname.includes('scholar.google.')) {
        setLocalError('Please use a Google Scholar URL (scholar.google.com)');
        return;
      }

      const userId = urlObj.searchParams.get('user');
      if (!userId || userId.length < 12) {
        setLocalError('Invalid Google Scholar URL. Missing or invalid user ID.');
        return;
      }

      const normalizedUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}`;
      onSearch(normalizedUrl);
    } catch {
      setLocalError('Invalid URL. Please paste a valid Google Scholar profile URL.');
    }
  }, [input, onSearch]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setLocalError(null);
  }, []);

  const handleSampleLink = useCallback(() => {
    const sampleUrl = 'https://scholar.google.com/citations?user=NOSPtp8AAAAJ&hl=en';
    setInput(sampleUrl);
    setLocalError(null);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative search-focus-glow rounded-lg transition-all">
        {error && (
          <div className="absolute -top-6 left-0 right-0 text-xs text-[#64748b] flex items-center">
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            <span>{error}</span>
          </div>
        )}
        <input
          type="url"
          value={input}
          onChange={handleInputChange}
          placeholder="Paste Google Scholar profile URL..."
          disabled={isLoading}
          className={`w-full ${
            compact
              ? 'py-1.5 pl-9 pr-24 text-xs'
              : 'py-3 pl-12 pr-28 text-sm'
          } text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border ${
            error ? 'border-[#64748b] focus:border-[#2d7d7d] focus:ring-[#2d7d7d]/20' : 'border-gray-200 dark:border-slate-600 focus:border-[#2d7d7d] focus:ring-[#2d7d7d]/20'
          } rounded-lg focus:outline-none focus:ring-2 transition-all`}
          autoComplete="off"
          spellCheck="false"
        />
        <div className={`absolute ${
          compact ? 'left-3 top-2' : 'left-4 top-3.5'
        } flex items-center justify-center`}>
          <Search className={`h-5 w-5 ${error ? 'text-[#64748b]' : 'gradient-icon'}`} />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={`absolute flex items-center justify-center ${
            compact ? 'right-2 top-1' : 'right-2 top-2'
          } px-4 py-1.5 bg-[#2d7d7d] text-white rounded-lg btn-lift disabled:opacity-50 disabled:cursor-not-allowed space-x-2 text-xs min-w-[80px]`}
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              <span>Explore</span>
            </>
          )}
        </button>
      </div>

      {isLoading && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full progress-shimmer rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5 text-center">
            {progress < 30 ? 'Connecting to Google Scholar...' :
             progress < 60 ? 'Fetching publications...' :
             progress < 85 ? 'Calculating metrics...' :
             progress < 100 ? 'Almost done...' :
             'Complete!'}
          </p>
        </div>
      )}

      {!error && !compact && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Search className="h-3.5 w-3.5 gradient-icon" />
            <span>Paste a Google Scholar profile URL</span>
          </div>
          <button
            type="button"
            onClick={handleSampleLink}
            className="flex items-center space-x-1 text-[#2d7d7d] hover:text-[#1f5c5c] transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>See an example portfolio</span>
          </button>
        </div>
      )}
    </form>
  );
}
