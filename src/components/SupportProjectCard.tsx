import { Heart } from 'lucide-react';

/**
 * Quiet, voluntary support card at the bottom of a profile. It used to sit
 * above the tabs, which read as a paywall prompt before visitors had seen
 * anything; ScholarFolio is a free open-source research project.
 */
export function SupportProjectCard({ onSupport }: { onSupport: () => void }) {
  return (
    <aside className="mt-10 rounded-xl border border-gray-100 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <Heart className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
          ScholarFolio is a free, open-source research project: no ads, no subscriptions, no paywalled features.
          If it was useful to you, you can voluntarily help cover the Google Scholar data and hosting costs.
        </p>
      </div>
      <button
        type="button"
        onClick={onSupport}
        className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2d7d7d] dark:text-[#5bbdbd] border border-[#2d7d7d]/25 hover:bg-[#eaf4f4] dark:hover:bg-[#2d7d7d]/15 rounded-lg transition-colors whitespace-nowrap"
      >
        Support the project
      </button>
    </aside>
  );
}
