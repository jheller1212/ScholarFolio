import { Info } from 'lucide-react';
import type { Author } from '../types/scholar';

interface SourceDiscrepancyNoteProps {
  data: Author;
  /** OpenAlex fallback profiles have no Google Scholar number to compare. */
  isOpenAlexProfile: boolean;
  className?: string;
}

export const SOURCES_GUIDE_URL = '/guides/google-scholar-vs-openalex';

/**
 * Explains why headline (Google Scholar) and OpenAlex-based numbers differ.
 * The mismatch is the most common reason people report a profile as wrong.
 */
export function SourceDiscrepancyNote({ data, isOpenAlexProfile, className = '' }: SourceDiscrepancyNoteProps) {
  const oa = data.openAccess;
  if (isOpenAlexProfile || !oa?.openAlexCitations || !oa.matchedWorks || data.totalCitations <= 0) return null;

  const gs = data.totalCitations.toLocaleString();
  const openAlex = oa.openAlexCitations.toLocaleString();
  const pubs = data.publications.length;

  return (
    <details className={`group rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/60 text-xs text-gray-600 dark:text-gray-300 ${className}`}>
      <summary className="flex items-start gap-2 cursor-pointer list-none px-3 py-2 [&::-webkit-details-marker]:hidden">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
        <span>
          Google Scholar counts <strong className="font-semibold text-gray-800 dark:text-gray-100">{gs}</strong> citations,
          OpenAlex counts <strong className="font-semibold text-gray-800 dark:text-gray-100">{openAlex}</strong>
          {oa.matchedWorks < pubs ? ` for the ${oa.matchedWorks} of ${pubs} publications it could match` : ''}.{' '}
          <span className="text-[#2d7d7d] dark:text-[#5bbdbd] underline-offset-2 group-open:hidden">Here&rsquo;s why they differ</span>
        </span>
      </summary>
      <div className="px-3 pb-3 pl-8 space-y-2 leading-relaxed">
        <p>Both are right about what they measure; they just look at different parts of the literature.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Google Scholar</strong> crawls the web, so it also counts citations from preprints, books, theses, reports, slides and non-English venues. It tends to be higher, and occasionally includes duplicates or misattributed papers.</li>
          <li><strong>OpenAlex</strong> is an open, curated database of scholarly works. Its counts are lower but reproducible and free to reuse; it powers the open-access, field-normalised and co-author numbers on this page.</li>
        </ul>
        <p>Headline numbers (citations, h-index, i10) come from Google Scholar so they match what you see there.</p>
        <a href={SOURCES_GUIDE_URL} className="inline-block font-medium text-[#2d7d7d] dark:text-[#5bbdbd] hover:underline">
          Read the full comparison &rarr;
        </a>
      </div>
    </details>
  );
}
