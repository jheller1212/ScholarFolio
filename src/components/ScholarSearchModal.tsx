import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader2, User, GraduationCap } from 'lucide-react';
import { scholarService, type AuthorSearchResult } from '../services/scholar';

interface ScholarSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profileUrl: string) => void;
}

export function ScholarSearchModal({ isOpen, onClose, onSelect }: ScholarSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AuthorSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
      setSearched(false);
      setError(null);
    }
  }, [isOpen]);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const profiles = await scholarService.searchAuthors(searchQuery.trim());
      setResults(profiles);
      setSearched(true);
    } catch {
      setError('Search failed. Please try again.');
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  }, [doSearch]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query);
  }, [query, doSearch]);

  const handleSelect = useCallback((authorId: string) => {
    const profileUrl = `https://scholar.google.com/citations?user=${authorId}`;
    onSelect(profileUrl);
    onClose();
  }, [onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 flex items-center">
            <Search className="h-4 w-4 text-[#2d7d7d] mr-2" />
            Search by Author Name
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Search input */}
        <form onSubmit={handleSubmit} className="p-4 border-b border-gray-50 flex-shrink-0">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="e.g. Albert Einstein"
              className="w-full px-4 py-2.5 pl-10 pr-20 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2d7d7d] focus:ring-2 focus:ring-[#2d7d7d]/20 focus:bg-white transition-all"
              autoComplete="off"
              spellCheck="false"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            {loading && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 text-[#2d7d7d] animate-spin" />
            )}
          </div>
        </form>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {error && (
            <p className="text-sm text-gray-500 text-center py-8">{error}</p>
          )}

          {!error && searched && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No authors found. Try a different name.</p>
          )}

          {results.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {results.map((profile) => (
                <li key={profile.authorId}>
                  <button
                    onClick={() => handleSelect(profile.authorId)}
                    className="w-full text-left px-4 py-3 hover:bg-[#eaf4f4]/50 transition-colors flex items-start gap-3"
                  >
                    {profile.imageUrl ? (
                      <img
                        src={profile.imageUrl}
                        alt={profile.name}
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#eaf4f4] flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-[#2d7d7d]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {profile.name}
                      </div>
                      {profile.affiliation && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {profile.affiliation}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {profile.citedBy > 0 && (
                          <span className="text-xs text-gray-400">
                            Cited by {profile.citedBy.toLocaleString()}
                          </span>
                        )}
                        {profile.interests.length > 0 && (
                          <span className="text-xs text-gray-400 truncate">
                            {profile.interests.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!error && !searched && !loading && (
            <div className="py-10 text-center">
              <GraduationCap className="h-8 w-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Type an author name to search Google Scholar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
