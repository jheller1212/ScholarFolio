import React, { useState } from 'react';
import { MapPin, GraduationCap, Link, ArrowRight, BadgeCheck, UserCheck, Database } from 'lucide-react';
import type { AuthorSearchResult } from '../services/scholar/index';
import type { ClaimStatus } from '../services/claimed-profiles';

export function UrlFallback({ message, pastedUrl, setPastedUrl, urlError, setUrlError, onSubmit, compact }: {
  message: string;
  pastedUrl: string;
  setPastedUrl: (v: string) => void;
  urlError: string | null;
  setUrlError: (v: string | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="mt-4 w-full text-center text-xs text-gray-400 hover:text-[#2d7d7d] transition-colors flex items-center justify-center gap-1.5 py-2"
      >
        <Link className="h-3 w-3" />
        {message} Paste a Google Scholar URL instead
      </button>
    );
  }

  return (
    <div className={compact ? 'mt-4 pt-4 border-t border-gray-100 dark:border-gray-700' : 'mt-4'}>
      {!compact && <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">{message}</p>}
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={pastedUrl}
            onChange={e => { setPastedUrl(e.target.value); setUrlError(null); }}
            placeholder="https://scholar.google.com/citations?user=..."
            aria-label="Google Scholar profile URL"
            className="w-full px-4 py-2 pl-9 text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-[#2d7d7d] focus:ring-2 focus:ring-[#2d7d7d]/20 transition-all"
            autoComplete="off"
            spellCheck="false"
          />
          <Link className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
        </div>
        <button
          type="submit"
          disabled={!pastedUrl.trim()}
          className="px-3 py-2 bg-[#2d7d7d] text-white text-xs font-medium rounded-lg hover:bg-[#236363] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          Go <ArrowRight className="h-3 w-3" />
        </button>
      </form>
      {urlError && <p className="text-xs text-red-500 mt-1.5">{urlError}</p>}
    </div>
  );
}

function ClaimBadge({ status }: { status: ClaimStatus }) {
  // Lets people tell a real researcher's own page apart from same-name profiles.
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#2d7d7d] dark:text-[#5fb3b3]" title="Claimed on ScholarFolio and verified via ORCID">
        <BadgeCheck className="h-3 w-3" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300" title="Claimed by its owner on ScholarFolio">
      <UserCheck className="h-3 w-3" /> Claimed
    </span>
  );
}

export function SearchResultItem({ profile, claim, onSelect }: {
  profile: AuthorSearchResult;
  claim?: ClaimStatus;
  onSelect: (authorId: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(profile.authorId)}
      className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-[#2d7d7d] hover:bg-[#2d7d7d]/5 dark:hover:bg-[#2d7d7d]/10 transition-all group"
    >
      <div className="flex items-start gap-3">
        {profile.imageUrl ? (
          <img
            src={profile.imageUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-800"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-[#2d7d7d] transition-colors break-words">
            <span>{profile.name}</span>
            {claim && <ClaimBadge status={claim} />}
          </p>
          {/* Full affiliation, wrapped: it is the main way to tell namesakes apart. */}
          {profile.affiliation && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-start gap-1 break-words">
              <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{profile.affiliation}</span>
            </p>
          )}
          {(profile.citedBy > 0 || profile.interests.length > 0) && (
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 break-words">
              {profile.citedBy > 0 && <span>Cited by {profile.citedBy.toLocaleString()}</span>}
              {profile.citedBy > 0 && profile.interests.length > 0 && <span aria-hidden="true"> · </span>}
              {profile.interests.length > 0 && <span>{profile.interests.slice(0, 4).join(', ')}</span>}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function NoResultsTips({ query }: { query: string }) {
  return (
    <div className="py-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No profiles found for &ldquo;{query}&rdquo;</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">We searched Google Scholar and OpenAlex. Some things to try:</p>
      <ul className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-300 list-disc pl-5">
        <li>Search the first and last name only, without titles or middle initials.</li>
        <li>Check the spelling, or try the name as it appears on their papers.</li>
        <li>Not everyone has a public Google Scholar profile. If they do, paste its link below.</li>
      </ul>
    </div>
  );
}

export function OpenAlexNotice() {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 px-3 py-2">
      <Database className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
      <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
        Showing results from <span className="font-medium">OpenAlex</span>, the open research catalogue. Metrics may differ slightly from Google Scholar.
      </p>
    </div>
  );
}
