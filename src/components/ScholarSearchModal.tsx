import React, { useState } from 'react';
import { Search, X, ExternalLink, Loader2, Info } from 'lucide-react';

interface ScholarSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScholarSearchModal({ isOpen, onClose }: ScholarSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || loading) return;

    setLoading(true);
    try {
      // Construct the Google Scholar search URL
      const searchUrl = `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(searchQuery)}`;
      window.open(searchUrl, '_blank');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Search className="h-5 w-5 text-[#2d7d7d] mr-2" />
            Find Your Google Scholar Profile
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter author name..."
                className="w-full px-4 py-3 pl-12 text-gray-700 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-primary-start focus:ring-2 focus:ring-primary-start/20 transition-all"
              />
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <button
                type="submit"
                disabled={!searchQuery.trim() || loading}
                className="absolute right-2 top-2 px-4 py-1.5 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <span>Search</span>
                )}
              </button>
            </div>
          </form>

          <div className="bg-[#eaf4f4] rounded-xl p-4 text-sm text-[#1e293b]">
            <h3 className="font-medium mb-2 flex items-center">
              <Info className="h-4 w-4 mr-1" />
              How to find your Google Scholar profile URL:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-[#334155]">
              <li>Click the Search button above to open Google Scholar</li>
              <li>Find your profile in the search results</li>
              <li>Click on your name to open your profile</li>
              <li>Copy the URL from your browser's address bar</li>
              <li>Paste the URL back in the main search box</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}