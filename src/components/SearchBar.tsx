import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, ExternalLink, Loader2, AlertCircle, BookOpen, User } from 'lucide-react';
import DOMPurify from 'dompurify';
import { scholarService, type AuthorSearchResult } from '../services/scholar/index';

interface SearchBarProps {
  onSearch: (url: string) => void;
  isLoading?: boolean;
  compact?: boolean;
  error?: string | null;
}

function isScholarUrl(input: string): boolean {
  try {
    const urlObj = new URL(input.trim());
    return urlObj.hostname.includes('scholar.google.') && urlObj.searchParams.has('user');
  } catch {
    return false;
  }
}

export function SearchBar({ onSearch, isLoading = false, compact = false, error: externalError }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [searchResults, setSearchResults] = useState<AuthorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Close results dropdown when clicking outside
  useEffect(() => {
    if (!showResults) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showResults]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    setLocalError(null);

    if (!trimmed) {
      setLocalError('Enter a researcher name or Google Scholar URL');
      return;
    }

    // If it looks like a URL, handle it directly
    if (isScholarUrl(trimmed)) {
      const sanitized = DOMPurify.sanitize(trimmed);
      try {
        const urlObj = new URL(sanitized);
        const userId = urlObj.searchParams.get('user');
        if (!userId || userId.length < 12) {
          setLocalError('Invalid Google Scholar URL. Missing or invalid user ID.');
          return;
        }
        const normalizedUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}`;
        setShowResults(false);
        onSearch(normalizedUrl);
      } catch {
        setLocalError('Invalid URL format.');
      }
      return;
    }

    // Otherwise, search by name
    if (trimmed.length < 2) {
      setLocalError('Please enter at least 2 characters to search');
      return;
    }

    setSearching(true);
    setSearchResults([]);
    setShowResults(true);
    try {
      const results = await scholarService.searchAuthors(trimmed);
      setSearchResults(results);
      if (results.length === 0) {
        setLocalError('No researchers found. Try a different name or paste a Google Scholar URL.');
        setShowResults(false);
      }
    } catch {
      setLocalError('Search failed. Try pasting a Google Scholar URL instead.');
      setShowResults(false);
    } finally {
      setSearching(false);
    }
  }, [input, onSearch]);

  const handleSelectAuthor = useCallback((result: AuthorSearchResult) => {
    const url = `https://scholar.google.com/citations?user=${encodeURIComponent(result.authorId)}`;
    setShowResults(false);
    setSearchResults([]);
    setInput(result.name);
    onSearch(url);
  }, [onSearch]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setLocalError(null);
    if (!e.target.value.trim()) {
      setShowResults(false);
      setSearchResults([]);
    }
  }, []);

  const handleSampleLink = useCallback(() => {
    const sampleUrl = 'https://scholar.google.com/citations?user=NOSPtp8AAAAJ&hl=en';
    setInput(sampleUrl);
    setLocalError(null);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full" ref={containerRef}>
      <div className="relative search-focus-glow rounded-lg transition-all">
        {error && (
          <div className="absolute -top-6 left-0 right-0 text-xs text-[#64748b] flex items-center">
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            <span>{error}</span>
          </div>
        )}
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Search by name or paste Google Scholar URL..."
          disabled={isLoading}
          className={`w-full ${
            compact
              ? 'py-1.5 pl-9 pr-16 text-xs'
              : 'py-3 pl-12 pr-24 text-sm'
          } text-gray-700 bg-white border ${
            error ? 'border-[#64748b] focus:border-[#2d7d7d] focus:ring-[#2d7d7d]/20' : 'border-gray-200 focus:border-[#2d7d7d] focus:ring-[#2d7d7d]/20'
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
          disabled={!input.trim() || isLoading || searching}
          className={`absolute flex items-center justify-center ${
            compact ? 'right-2 top-1' : 'right-2 top-2'
          } px-4 py-1.5 bg-[#2d7d7d] text-white rounded-lg btn-lift disabled:opacity-50 disabled:cursor-not-allowed space-x-2 text-xs min-w-[80px]`}
        >
          {isLoading || searching ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{searching ? 'Searching...' : 'Loading...'}</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              <span>Explore</span>
            </>
          )}
        </button>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-[400px] overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found — select a profile
              </p>
            </div>
            {searchResults.map((result, i) => (
              <button
                key={result.authorId}
                type="button"
                onClick={() => handleSelectAuthor(result)}
                className={`w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors flex items-start gap-3 ${
                  i < searchResults.length - 1 ? 'border-b border-gray-100 dark:border-slate-700/50' : ''
                }`}
              >
                {result.imageUrl ? (
                  <img
                    src={result.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover flex-shrink-0 bg-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {result.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {result.affiliation}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {result.citedBy > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {result.citedBy.toLocaleString()} citations
                      </span>
                    )}
                    {result.interests.length > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {result.interests.slice(0, 3).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        )}
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

      {error && !compact && (
        <div className="mt-2 flex items-start space-x-1">
          <div className="flex items-center space-x-1 text-[#64748b] text-xs">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {!error && !compact && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Search className="h-3.5 w-3.5 gradient-icon" />
            <span>Search by name or paste a Google Scholar profile URL</span>
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
