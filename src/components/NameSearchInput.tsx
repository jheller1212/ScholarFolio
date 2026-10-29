import React, { useId, useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { useAuthorTypeahead } from '../hooks/useAuthorTypeahead';
import type { NameSuggestion } from '../lib/nameSuggestions';

interface NameSearchInputProps {
  onSearch: (name: string) => void;
  isLoading: boolean;
}

/**
 * The landing page's name search box, with live OpenAlex suggestions as an
 * ARIA 1.2 combobox. Suggestions only fill in a name: picking one runs the
 * same name search as pressing Enter, so nothing here spends a lookup.
 */
export function NameSearchInput({ onSearch, isLoading }: NameSearchInputProps) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useAuthorTypeahead(name, open && !isLoading);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const expanded = open && suggestions.length > 0;

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && !isLoading) onSearch(trimmed);
  };

  const pick = (s: NameSuggestion) => {
    setName(s.name);
    setOpen(false);
    setActiveIndex(-1);
    submit(s.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    submit(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!expanded) {
        if (e.key === 'ArrowDown') setOpen(true);
        return;
      }
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // -1 is "back in the text field": wrapping passes through it.
      setActiveIndex(i => {
        const next = i + step;
        if (next >= suggestions.length) return -1;
        if (next < -1) return suggestions.length - 1;
        return next;
      });
      return;
    }
    if (e.key === 'Enter' && expanded && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" role="search">
      <div className="relative search-focus-glow rounded-lg transition-all">
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setOpen(true); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => { setOpen(false); setActiveIndex(-1); }}
          placeholder="Search by researcher name..."
          aria-label="Researcher name"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          disabled={isLoading}
          className="w-full py-3 pl-12 pr-28 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 focus:border-[#2d7d7d] focus:ring-[#2d7d7d]/20 rounded-lg focus:outline-none focus:ring-2 transition-all"
          autoComplete="off"
          spellCheck="false"
        />
        <div className="absolute left-4 top-3.5 flex items-center justify-center">
          <Search className="h-5 w-5 gradient-icon" />
        </div>
        <button
          type="submit"
          disabled={name.trim().length < 2 || isLoading}
          className="absolute right-2 top-2 px-4 py-1.5 bg-[#2d7d7d] text-white rounded-lg btn-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-xs min-w-[80px]"
        >
          <Search className="h-4 w-4" />
          <span>Find</span>
        </button>

        <ul
          id={listId}
          role="listbox"
          aria-label="Suggested researchers"
          hidden={!expanded}
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1 text-left"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown, not click: it fires before the input's blur closes the list.
              onMouseDown={e => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-4 py-2.5 ${i === activeIndex ? 'bg-[#eaf4f4] dark:bg-[#2d7d7d]/20' : ''}`}
            >
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{s.name}</span>
              {s.institution && (
                <span className="mt-0.5 flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400 break-words">
                  <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {s.institution}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only" aria-live="polite">
        {expanded ? `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} available. Use the arrow keys to choose.` : ''}
      </p>
    </form>
  );
}
