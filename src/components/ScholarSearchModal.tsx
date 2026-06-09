import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, MapPin, GraduationCap, Loader2 } from 'lucide-react';
import { scholarService, type AuthorSearchResult } from '../services/scholar/index';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoSearched = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (initialQuery && !hasAutoSearched.current) {
        setName(initialQuery);
        hasAutoSearched.current = true;
        // Auto-trigger search
        (async () => {
          setLoading(true);
          setSearched(true);
          setError(null);
          try {
            const profiles = await scholarService.searchAuthors(initialQuery);
            setResults(profiles);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed.');
            setResults([]);
          } finally {
            setLoading(false);
          }
        })();
      } else {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } else {
      setName('');
      setResults([]);
      setSearched(false);
      setError(null);
      setLoading(false);
      hasAutoSearched.current = false;
    }
  }, [isOpen, initialQuery]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = name.trim();
    if (!query || query.length < 2) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const profiles = await scholarService.searchAuthors(query);
      setResults(profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [name]);

  const handleSelect = useCallback((authorId: string) => {
    const url = `https://scholar.google.com/citations?user=${authorId}`;
    onSelect(url);
    onClose();
  }, [onSelect, onClose]);

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
              <p className="text-sm">Searching Google Scholar...</p>
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">No profiles found for "{name.trim()}"</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different spelling or include the full name</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-3">{results.length} profile{results.length !== 1 ? 's' : ''} found — select the correct one</p>
              {results.map((profile) => (
                <button
                  key={profile.authorId}
                  onClick={() => handleSelect(profile.authorId)}
                  className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-[#2d7d7d] hover:bg-[#2d7d7d]/5 dark:hover:bg-[#2d7d7d]/10 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {profile.imageUrl ? (
                      <img
                        src={profile.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-800"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-[#2d7d7d] transition-colors truncate">
                        {profile.name}
                      </p>
                      {profile.affiliation && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {profile.affiliation}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {profile.citedBy > 0 && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            Cited by {profile.citedBy.toLocaleString()}
                          </span>
                        )}
                        {profile.interests.length > 0 && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                            {profile.interests.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
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
