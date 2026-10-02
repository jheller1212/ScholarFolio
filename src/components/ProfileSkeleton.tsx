import { useEffect, useState } from 'react';

// Rough timeline of a fresh profile build. The stages are time-based, not
// real progress events, but they tell a waiting visitor that work is
// happening and why it takes a few seconds.
const STAGES = [
  { at: 0, text: 'Fetching publications…' },
  { at: 4000, text: 'Computing metrics…' },
  { at: 9000, text: 'Writing narrative…' },
  { at: 16000, text: 'Almost there — large profiles take a little longer…' },
];

export function ProfileSkeleton() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = STAGES.slice(1).map((s, i) => window.setTimeout(() => setStage(i + 1), s.at));
    return () => timers.forEach(t => window.clearTimeout(t));
  }, []);

  return (
    <div className="min-h-screen mesh-bg overflow-x-hidden">
      {/* Header skeleton */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-gray-100/80 dark:border-slate-700/80">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-4">
            <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="skeleton w-28 h-5 hidden sm:block" />
            <div className="flex-1 max-w-xs ml-auto skeleton h-8 rounded-lg" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6" aria-busy="true">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300" role="status" aria-live="polite">
          <span className="h-4 w-4 flex-shrink-0 border-2 border-gray-200 dark:border-slate-600 border-t-[#2d7d7d] rounded-full animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span>{STAGES[stage].text}</span>
        </div>

        {/* Profile card skeleton — mirrors the ProfileView summary card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card p-4 sm:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="skeleton w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="skeleton w-40 max-w-full h-6" />
                <div className="skeleton w-56 max-w-full h-4" />
              </div>
            </div>
            {/* Four hero numbers, as in HeroMetrics */}
            <div className="grid grid-cols-4 gap-2 sm:gap-6 w-full md:w-auto">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-1">
                  <div className="skeleton w-10 sm:w-12 h-6 sm:h-7 mx-auto" />
                  <div className="skeleton w-12 sm:w-16 h-3 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 md:pl-20 flex flex-wrap gap-2">
            <div className="skeleton w-24 h-6 rounded-full" />
            <div className="skeleton w-16 h-6 rounded-full" />
            <div className="skeleton w-14 h-6 rounded-full" />
          </div>
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-700 space-y-2">
            <div className="skeleton w-full h-3" />
            <div className="skeleton w-4/5 h-3" />
          </div>
        </div>

        {/* Tab bar skeleton — clipped instead of overflowing on narrow screens */}
        <div className="mb-6 overflow-hidden">
          <div className="flex gap-1 p-1 bg-gray-100/80 dark:bg-slate-800/80 rounded-xl w-max max-w-full">
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton rounded-lg h-9 w-20 sm:w-28 flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Metrics grid skeleton — matches grid-cols-2 sm:3 md:4 lg:5 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={`${i >= 4 ? 'hidden sm:block' : ''} bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-card`}>
              <div className="flex items-start gap-2.5">
                <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="skeleton w-20 max-w-full h-3" />
                  <div className="skeleton w-14 max-w-full h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
