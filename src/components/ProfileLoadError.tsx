import { useState } from 'react';
import { AlertCircle, ArrowLeft, RotateCw, Search } from 'lucide-react';
import { Logo } from './Logo';
import { ScholarSearchModal } from './ScholarSearchModal';
import { friendlyProfileError } from '../lib/profileErrors';

interface ProfileLoadErrorProps {
  code: string | null;
  rawMessage: string;
  /** Prefill for the name search; empty when only an id is known. */
  nameQuery: string;
  retrying: boolean;
  onRetry: () => void;
  onSearch: (url: string) => void;
  onHome: () => void;
  authControls?: React.ReactNode;
}

/**
 * Shown in place of a profile that failed to load. Replaces a modal whose
 * only button sent people to the landing page and wiped the deep link, so a
 * transient Scholar hiccup meant starting over. The URL is left untouched
 * here: retrying or sharing still points at the same profile.
 */
export function ProfileLoadError({ code, rawMessage, nameQuery, retrying, onRetry, onSearch, onHome, authControls }: ProfileLoadErrorProps) {
  const [query, setQuery] = useState(nameQuery);
  const [showSearch, setShowSearch] = useState(false);
  const { title, message } = friendlyProfileError(code);

  return (
    <div className="min-h-[70vh]">
      <header className="border-b border-gray-100/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={onHome}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
          <Logo size={24} />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Scholar Folio</span>
          <div className="ml-auto">{authControls}</div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card p-6" role="alert">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{message}</p>
            </div>
          </div>

          <button
            onClick={onRetry}
            disabled={retrying}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying...' : 'Retry this profile'}
          </button>

          <form
            onSubmit={(e) => { e.preventDefault(); if (query.trim().length >= 2) setShowSearch(true); }}
            className="mt-4"
          >
            <label htmlFor="error-name-search" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Or find the researcher by name
            </label>
            <div className="flex gap-2">
              <input
                id="error-name-search"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. Jane Doe"
                autoComplete="off"
                className="flex-1 min-w-0 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:border-[#2d7d7d] focus:ring-2 focus:ring-[#2d7d7d]/20"
              />
              <button
                type="submit"
                disabled={query.trim().length < 2}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#2d7d7d] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] rounded-lg transition-colors disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </div>
          </form>

          <details className="mt-5 text-xs text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">Technical details</summary>
            <p className="mt-2 font-mono break-words bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
              {code ? `[${code}] ` : ''}{rawMessage}
            </p>
            <p className="mt-2">
              Still stuck? Email{' '}
              <a href="mailto:info@scholarfolio.org" className="text-[#2d7d7d] hover:underline">info@scholarfolio.org</a>
              {' '}with the link to this page.
            </p>
          </details>
        </div>
      </main>

      <ScholarSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={onSearch}
        initialQuery={query.trim()}
      />
    </div>
  );
}
