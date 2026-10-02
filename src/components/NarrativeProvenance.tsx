import { useEffect, useState } from 'react';
import { fetchProfileDataAsOf } from '../services/profile-freshness';

interface NarrativeProvenanceProps {
  scholarId: string;
  isOpenAlexProfile: boolean;
  /** True when this page load fetched fresh data (cache miss). */
  freshFetch: boolean;
  onSuggestCorrection: () => void;
  correctionOpen: boolean;
}

const formatDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Says where the narrative came from and how old the data is. People file
 * reports when the text disagrees with what they know; a visible source and
 * date explains most of those before they happen.
 */
export function NarrativeProvenance({ scholarId, isOpenAlexProfile, freshFetch, onSuggestCorrection, correctionOpen }: NarrativeProvenanceProps) {
  const [asOf, setAsOf] = useState<Date | null>(null);

  useEffect(() => {
    // Live fetches (and OpenAlex profiles, which are never cached) are as of now.
    if (freshFetch || isOpenAlexProfile) {
      setAsOf(new Date());
      return;
    }
    let cancelled = false;
    fetchProfileDataAsOf(scholarId).then(d => { if (!cancelled) setAsOf(d); });
    return () => { cancelled = true; };
  }, [scholarId, isOpenAlexProfile, freshFetch]);

  const sources = isOpenAlexProfile ? 'OpenAlex' : 'Google Scholar and OpenAlex';

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
      <span>Written automatically from {sources}</span>
      {asOf && (
        <>
          <span aria-hidden="true">·</span>
          <span>data as of {formatDate(asOf)}</span>
        </>
      )}
      <span aria-hidden="true">·</span>
      <a href="/about#data-sources" target="_blank" rel="noopener" className="underline hover:text-gray-600 dark:hover:text-gray-300">
        How this works
      </a>
      <span className="basis-full sm:basis-auto sm:ml-auto">
        <button
          type="button"
          onClick={onSuggestCorrection}
          aria-expanded={correctionOpen}
          className="py-1 text-gray-500 dark:text-gray-400 hover:text-[#2d7d7d] dark:hover:text-[#5bbdbd] underline-offset-2 hover:underline"
        >
          Something off? Suggest a correction
        </button>
      </span>
    </div>
  );
}
