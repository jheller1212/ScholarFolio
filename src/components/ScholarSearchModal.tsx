import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, GraduationCap, Loader2, Database } from 'lucide-react';
import { scholarService, type AuthorSearchResult } from '../services/scholar/index';
import { searchOpenAlexAuthors, OPENALEX_ID_PREFIX } from '../services/openalex';
import { fetchClaimStatuses, type ClaimStatus } from '../services/claimed-profiles';
import { UrlFallback, SearchResultItem, NoResultsTips, OpenAlexNotice } from './ScholarSearchResults';

interface ScholarSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profileUrl: string) => void;
  initialQuery?: string;
}

export function ScholarSearchModal({ isOpen, onClose, onSelect, initialQuery = '' }: ScholarSearchModalProps) {
  const [name, setName] = useState('');
  const [results, setResults] = useState<AuthorSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'scholar' | 'openalex'>('scholar');
  const [pastedUrl, setPastedUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [claims, setClaims] = useState<Map<string, ClaimStatus>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoSearched = useRef(false);

  // Badges arrive after the results so a slow lookup never delays the list.
  useEffect(() => {
    let cancelled = false;
    setClaims(new Map());
    if (results.length === 0) return;
    fetchClaimStatuses(results.map(r => r.authorId)).then(map => {
      if (!cancelled) setClaims(map);
    });
    return () => { cancelled = true; };
  }, [results]);

  // Explicit OpenAlex search for when Scholar returned only namesakes: the
  // automatic fallback below runs only when Scholar has no results at all.
  const runOpenAlexSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const oaProfiles = await searchOpenAlexAuthors(query);
      setResults(oaProfiles);
      setSource('openalex');
    } catch {
      setError('OpenAlex search is unavailable right now. Please try again, or paste a Google Scholar URL.');
    }
    setLoading(false);
  }, []);

  // Try Google Scholar first; if it returns nothing or hard-fails, fall back to
  // OpenAlex's open dataset so users still get a result when Scholar is blocked.
  const runSearch = useCallback(async (query: string) => {
    // People paste a profile link into the name box. Recognise it and open the
    // profile instead of searching for the URL as if it were a name — that
    // always hard-failed (SerpAPI finds nothing, the scrape fallback gets a
    // 403), and it was the single most common logged search error.
    const directUrl = scholarService.scholarProfileUrlFrom(query);
    if (directUrl) {
      onSelect(directUrl);
      onClose();
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setSource('scholar');

    if (scholarService.looksLikeUrl(query)) {
      setResults([]);
      setError('That looks like a link rather than a name. Paste a Google Scholar profile URL (it contains "?user=") in the field below, or search by the researcher\'s name.');
      setLoading(false);
      return;
    }

    let scholarFailed = false;
    try {
      const profiles = await scholarService.searchAuthors(query);
      if (profiles.length > 0) {
        setResults(profiles);
        setLoading(false);
        return;
      }
    } catch {
      scholarFailed = true;
    }

    // Scholar empty or unavailable — try OpenAlex.
    try {
      const oaProfiles = await searchOpenAlexAuthors(query);
      if (oaProfiles.length > 0) {
        setResults(oaProfiles);
        setSource('openalex');
        setLoading(false);
        return;
      }
    } catch {
      // ignore — handled by the empty/error states below
    }

    setResults([]);
    if (scholarFailed) {
      setError('Search is temporarily unavailable. Please try again, or paste a Google Scholar URL.');
    }
    setLoading(false);
  }, [onSelect, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (initialQuery && !hasAutoSearched.current) {
        setName(initialQuery);
        hasAutoSearched.current = true;
        runSearch(initialQuery);
      } else {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } else {
      setName('');
      setResults([]);
      setSearched(false);
      setError(null);
      setSource('scholar');
      setLoading(false);
      setPastedUrl('');
      setUrlError(null);
      setClaims(new Map());
      hasAutoSearched.current = false;
    }
  }, [isOpen, initialQuery, runSearch]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const query = name.trim();
    if (!query || query.length < 2) return;
    runSearch(query);
  }, [name, runSearch]);

  const handleSelect = useCallback((authorId: string) => {
    // OpenAlex candidates carry an "openalex:<id>" token routed directly;
    // Google Scholar candidates are opened via their profile URL.
    const target = authorId.startsWith(OPENALEX_ID_PREFIX)
      ? authorId
      : `https://scholar.google.com/citations?user=${authorId}`;
    onSelect(target);
    onClose();
  }, [onSelect, onClose]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const url = pastedUrl.trim();
    if (!url) return;
    // Same recognition as the name box, so both fields accept exactly the same
    // set of links and hand on a normalized URL.
    const normalized = scholarService.scholarProfileUrlFrom(url);
    if (normalized) {
      onSelect(normalized);
      onClose();
    } else {
      setUrlError('Please paste a valid Google Scholar profile URL');
    }
  }, [pastedUrl, onSelect, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[10vh] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scholar-search-title"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full shadow-2xl flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 id="scholar-search-title" className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <Search className="h-4 w-4 text-[#2d7d7d] mr-2" />
            Find Researcher
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Search form */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(null); }}
                placeholder="Enter researcher name..."
                className="w-full px-4 py-2.5 pl-10 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-[#2d7d7d] focus:ring-2 focus:ring-[#2d7d7d]/20 focus:bg-white dark:focus:bg-gray-800 transition-all"
                autoComplete="off"
                spellCheck="false"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            <button
              type="submit"
              disabled={loading || name.trim().length < 2}
              className="px-4 py-2.5 bg-[#2d7d7d] text-white text-sm font-medium rounded-lg hover:bg-[#236363] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </form>
          {error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Searching{source === 'openalex' ? ' OpenAlex' : ''}...</p>
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <>
              <NoResultsTips query={name.trim()} />
              <UrlFallback
                message="Paste a Google Scholar profile link"
                pastedUrl={pastedUrl}
                setPastedUrl={setPastedUrl}
                urlError={urlError}
                setUrlError={setUrlError}
                onSubmit={handleUrlSubmit}
              />
            </>
          )}

          {!loading && searched && results.length === 0 && error && (
            <UrlFallback
              message="Paste a Google Scholar profile link instead"
              pastedUrl={pastedUrl}
              setPastedUrl={setPastedUrl}
              urlError={urlError}
              setUrlError={setUrlError}
              onSubmit={handleUrlSubmit}
            />
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              {source === 'openalex' && <OpenAlexNotice />}
              <p className="text-xs text-gray-400 mb-3">{results.length} profile{results.length !== 1 ? 's' : ''} found. Check the affiliation to pick the right person.</p>
              {results.map((profile) => (
                <SearchResultItem
                  key={profile.authorId}
                  profile={profile}
                  claim={claims.get(profile.authorId)}
                  onSelect={handleSelect}
                />
              ))}
              {source === 'scholar' && name.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => runOpenAlexSearch(name.trim())}
                  className="mt-3 w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:text-[#2d7d7d] transition-colors flex items-center justify-center gap-1.5 py-2"
                >
                  <Database className="h-3 w-3" />
                  Not the right person? Search OpenAlex instead
                </button>
              )}
              <UrlFallback
                message="Still not finding them?"
                pastedUrl={pastedUrl}
                setPastedUrl={setPastedUrl}
                urlError={urlError}
                setUrlError={setUrlError}
                onSubmit={handleUrlSubmit}
                compact
              />
            </div>
          )}

          {!loading && !searched && (
            <div className="text-center py-8">
              <GraduationCap className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Enter a researcher's name to find their profile</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
