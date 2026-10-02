import React, { useCallback, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { openCoAuthorProfile } from '../lib/openCoAuthorProfile';
import { coAuthorsOf } from '../utils/authorIdentity';
import type { Author } from '../types/scholar';

/**
 * Turns co-author names inside narrative text into buttons that open that
 * co-author's ScholarFolio profile in a new tab.
 */
export function useCoAuthorLinkify(data: Author, enabled: boolean): (text: string) => React.ReactNode {
  const coAuthorNames = useMemo(() => {
    const names = new Set<string>();
    for (const pub of data.publications) {
      // Owner variants (maiden name, umlaut spellings, extra initials) must
      // not be linkified as if they were other researchers.
      for (const author of coAuthorsOf(pub.authors, data.name)) {
        names.add(author.trim());
      }
    }
    return names;
  }, [data.publications, data.name]);

  const [searchingAuthor, setSearchingAuthor] = useState<string | null>(null);

  const handleAuthorClick = useCallback(async (authorName: string) => {
    if (searchingAuthor) return;
    setSearchingAuthor(authorName);
    try {
      await openCoAuthorProfile(authorName, 'close', 'ResearcherNarrative');
    } finally {
      setSearchingAuthor(null);
    }
  }, [searchingAuthor]);

  return useCallback((text: string): React.ReactNode => {
    if (!enabled || coAuthorNames.size === 0) return text;

    const matches: { name: string; start: number; end: number }[] = [];
    for (const name of coAuthorNames) {
      let idx = text.indexOf(name);
      while (idx !== -1) {
        matches.push({ name, start: idx, end: idx + name.length });
        idx = text.indexOf(name, idx + name.length);
      }
    }
    if (matches.length === 0) return text;

    // Sort by position and drop overlaps (first match wins).
    matches.sort((a, b) => a.start - b.start);
    const filtered: typeof matches = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        filtered.push(m);
        lastEnd = m.end;
      }
    }

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (const m of filtered) {
      if (m.start > cursor) parts.push(text.slice(cursor, m.start));
      const authorName = m.name;
      parts.push(
        <button
          key={`${m.start}-${authorName}`}
          onClick={() => handleAuthorClick(authorName)}
          className="text-[#2d7d7d] hover:text-[#1f5c5c] hover:underline transition-colors cursor-pointer inline"
          title={`View ${authorName}'s profile on ScholarFolio`}
        >
          {searchingAuthor === authorName ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin inline" />
              {authorName}
            </span>
          ) : authorName}
        </button>
      );
      cursor = m.end;
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return <>{parts}</>;
  }, [coAuthorNames, enabled, handleAuthorClick, searchingAuthor]);
}
