import { useState } from 'react';
import { Info, X } from 'lucide-react';

const DISMISS_KEY = 'openalex-notice-dismissed';

/**
 * Temporary notice shown on OpenAlex-powered surfaces (World Map, Open Science,
 * P-Index). OpenAlex began requiring API keys on 13 Feb 2026 and now hard-limits
 * anonymous access, which intermittently returns 503s under load. Remove this
 * component once the edge-function API-key proxy is live.
 */
export function OpenAlexNotice() {
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1'
  );

  if (dismissed) return null;

  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 mb-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
      <div className="pr-6 text-sm text-amber-900 dark:text-amber-100">
        <span className="font-semibold">This section may be temporarily incomplete.</span>{' '}
        Our open-data provider (OpenAlex) changed its API usage policy in February 2026
        and is currently rate-limiting requests. We&rsquo;re rolling out a fix and expect
        it back to normal shortly. Thanks for your patience!
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
        }}
        className="absolute top-2.5 right-2.5 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
