import { useEffect, useState } from 'react';
import { fetchAuthorAutocomplete } from '../services/openalex/name-suggestions';
import { isTypeaheadNameQuery, type NameSuggestion } from '../lib/nameSuggestions';

const DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 6;

// Session cache: backspacing over a name re-asks for prefixes already seen.
const cache = new Map<string, NameSuggestion[]>();

/**
 * Live OpenAlex author suggestions for a name being typed. Debounced, and each
 * new keystroke aborts the request in flight so a slow, stale answer can never
 * overwrite a newer one. Free: OpenAlex via the scholar proxy, no lookup spent.
 */
export function useAuthorTypeahead(input: string, enabled = true): NameSuggestion[] {
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);
  const query = input.trim();
  const active = enabled && isTypeaheadNameQuery(query);

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      return;
    }
    const key = query.toLowerCase();
    const cached = cache.get(key);
    if (cached) {
      setSuggestions(cached);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchAuthorAutocomplete(query, controller.signal).then(found => {
        if (controller.signal.aborted) return;
        const top = found.slice(0, MAX_SUGGESTIONS);
        // Empty may be a failed request, so it is not worth remembering.
        if (top.length > 0) cache.set(key, top);
        setSuggestions(top);
      });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, active]);

  return active ? suggestions : [];
}
