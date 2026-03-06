import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, ExternalLink, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { ApiError } from '../utils/api';
import DOMPurify from 'dompurify';

interface SearchBarProps {
  onSearch: (url: string) => void;
  isLoading?: boolean;
  compact?: boolean;
  error?: string | null;
}

export function SearchBar({ onSearch, isLoading = false, compact = false, error: externalError }: SearchBarProps) {
  const [url, setUrl] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const error = externalError || localError;

  // Progress bar that accelerates to ~90% over ~8s, then waits for completion
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const startTime = Date.now();
      const estimatedDuration = 8000; // 8 seconds estimated
      progressRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        // Asymptotic curve: approaches 90% but never reaches it
        const p = 90 * (1 - Math.exp(-2.5 * elapsed / estimatedDuration));
        setProgress(Math.min(p, 90));
      }, 100);
    } else {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
      if (progress > 0) {
        // Animate to 100% on completion
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

  const validateUrl = useCallback((url: string): boolean => {
    try {
      // Parse URL to validate format
      const urlObj = new URL(url.trim());
      
      // Check if it's a Google Scholar URL (any country domain)
      const isGoogleScholar = urlObj.hostname.includes('scholar.google.');
      
      // Check if it has a user parameter
      const hasUserParam = urlObj.searchParams.has('user');
      
      // Check if the user parameter has a valid format
      const userId = urlObj.searchParams.get('user');
      const validUserIdFormat = userId && userId.length >= 12;
      
      return isGoogleScholar && hasUserParam && validUserIdFormat;
    } catch (e) {
      // If URL parsing fails, it's not a valid URL
      return false;
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    setLocalError(null);
    
    if (!trimmedUrl) {
      setLocalError('Please enter a Google Scholar profile URL');
      return;
    }

    // Clear any previous errors before validation
    setLocalError(null);
    
    if (!validateUrl(trimmedUrl)) {
      setLocalError('Invalid URL format. Please enter a valid Google Scholar profile URL');
      return;
    }

    try {
      // Sanitize URL before processing
      const sanitizedUrl = DOMPurify.sanitize(trimmedUrl);
      
      // Normalize the URL
      const urlObj = new URL(sanitizedUrl);
      const userId = urlObj.searchParams.get('user');
      
      if (!userId) {
        setLocalError('Invalid Google Scholar URL. Missing user ID parameter.');
        return;
      }

      // Create a clean normalized URL with just the user parameter
      const normalizedUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}`;

      onSearch(normalizedUrl);
    } catch (err) {
      setLocalError('Invalid URL format. Please check the URL and try again.');
    }
  }, [url, onSearch, validateUrl]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setLocalError(null);
  }, []);

  const handleSampleLink = useCallback(() => {
    const sampleUrl = 'https://scholar.google.com/citations?user=NOSPtp8AAAAJ&hl=en';
    setUrl(sampleUrl);
    setLocalError(null);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        {error && (
          <div className="absolute -top-6 left-0 right-0 text-xs text-red-600 flex items-center">
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            <span>{error}</span>
          </div>
        )}
        <input
          type="url"
          value={url}
          onChange={handleUrlChange}
          placeholder="Enter Google Scholar profile URL..."
          disabled={isLoading}
          className={`w-full ${
            compact 
              ? 'py-1.5 pl-9 pr-16 text-xs' 
              : 'py-3 pl-12 pr-24 text-sm'
          } text-gray-700 bg-white border ${
            error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-primary-start focus:ring-primary-start/20'
          } rounded-lg focus:outline-none focus:ring-2 transition-all`}
          autoComplete="off"
          spellCheck="false"
        />
        <div className={`absolute ${
          compact ? 'left-3 top-2' : 'left-4 top-3.5'
        } flex items-center justify-center`}>
          <ExternalLink className={`h-5 w-5 ${error ? 'text-red-400' : 'gradient-icon'}`} />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || isLoading}
          className={`absolute flex items-center justify-center ${
            compact ? 'right-2 top-1' : 'right-2 top-2'
          } px-4 py-1.5 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed space-x-2 text-xs min-w-[80px]`}
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              <span>Analyze</span>
            </>
          )}
        </button>
      </div>

      {isLoading && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-start to-primary-end rounded-full transition-all duration-300 ease-out"
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
          <div className="flex items-center space-x-1 text-red-600 text-xs">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}
      
      {!error && !compact && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Search className="h-3.5 w-3.5 gradient-icon" />
            <span>Enter a Google Scholar profile URL to analyze metrics</span>
          </div>
          <button
            type="button"
            onClick={handleSampleLink}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Try a sample profile</span>
          </button>
        </div>
      )}
    </form>
  );
}