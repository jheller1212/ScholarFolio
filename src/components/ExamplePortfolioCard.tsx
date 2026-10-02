import { ArrowRight, FileText, MapPin } from 'lucide-react';

// A static snapshot of the example profile the landing page links to, so first-time
// visitors see what they get before they search. Rendered as markup rather than a
// screenshot: no image request, fixed dimensions (no layout shift), and it follows
// the theme. Numbers are a dated snapshot of the public Google Scholar profile;
// the button opens the live version.
const EXAMPLE = {
  name: 'Jonas Heller',
  affiliation: 'Assistant Professor in Marketing, Maastricht University',
  interests: ['Digital & Services Marketing', 'Immersive Realities', 'AR / VR', 'Decision Making'],
  snapshot: 'Oct 2026',
  metrics: [
    { label: 'Citations', value: '4,396' },
    { label: 'h-index', value: '25' },
    { label: 'i10-index', value: '32' },
  ],
  // Citations per year; the current year is partial and drawn lighter.
  citationsPerYear: [
    { year: 2018, count: 11 },
    { year: 2019, count: 50 },
    { year: 2020, count: 135 },
    { year: 2021, count: 262 },
    { year: 2022, count: 518 },
    { year: 2023, count: 743 },
    { year: 2024, count: 827 },
    { year: 2025, count: 1036 },
    { year: 2026, count: 742, partial: true },
  ],
} as const;

const MAX_COUNT = Math.max(...EXAMPLE.citationsPerYear.map(d => d.count));

interface ExamplePortfolioCardProps {
  onOpen: () => void;
}

export function ExamplePortfolioCard({ onOpen }: ExamplePortfolioCardProps) {
  return (
    <figure className="w-full max-w-2xl mx-auto text-left">
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card overflow-hidden">
        {/* Faux browser bar: shows the vanity-URL idea without a screenshot */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-slate-600" />
          </span>
          <span className="flex-1 truncate rounded-md bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            scholarfolio.org/<span className="text-[#2d7d7d] font-medium">your-name</span>
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 flex-shrink-0 rounded-full bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 flex items-center justify-center font-serif text-base font-semibold text-[#2d7d7d]" aria-hidden="true">
              JH
            </div>
            <div className="min-w-0">
              <p className="font-serif text-lg font-semibold text-[#1e293b] dark:text-gray-100 leading-tight">{EXAMPLE.name}</p>
              <p className="mt-0.5 text-xs text-[#64748b] dark:text-gray-400 flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{EXAMPLE.affiliation}</span>
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {EXAMPLE.interests.map(topic => (
              <span key={topic} className="rounded-full bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                {topic}
              </span>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5">
            <dl className="grid grid-cols-3 sm:grid-cols-1 gap-3 sm:gap-2 sm:w-28">
              {EXAMPLE.metrics.map(m => (
                <div key={m.label} className="rounded-lg bg-gray-50 dark:bg-slate-900/50 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{m.label}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-[#1e293b] dark:text-gray-100">{m.value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">Citations per year</p>
              <div className="flex items-end gap-1.5 h-28" role="img" aria-label="Bar chart of citations per year, rising from 11 in 2018 to 1,036 in 2025">
                {EXAMPLE.citationsPerYear.map(d => (
                  <div key={d.year} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className={`w-full rounded-t ${'partial' in d ? 'bg-[#2d7d7d]/35' : 'bg-[#2d7d7d]'}`}
                      style={{ height: `${Math.max(3, (d.count / MAX_COUNT) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1" aria-hidden="true">
                {EXAMPLE.citationsPerYear.map(d => (
                  <span key={d.year} className="flex-1 text-center text-[9px] tabular-nums text-gray-400 dark:text-gray-500">
                    {String(d.year).slice(2)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-dashed border-[#2d7d7d]/40 bg-[#eaf4f4]/60 dark:bg-[#2d7d7d]/10 px-3 py-2.5">
            <FileText className="h-4 w-4 text-[#2d7d7d] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#475569] dark:text-gray-300 leading-relaxed">
              <span className="font-medium text-[#1e293b] dark:text-gray-100">Narrative CV</span> — export a funder-ready draft (NWO, ERC, MSCA) as an editable Word file, pre-filled from the same record.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">Example profile · snapshot {EXAMPLE.snapshot}</span>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2d7d7d] hover:text-[#1f5c5c] dark:hover:text-[#5fb3b3] transition-colors"
            >
              Open the live example <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </figure>
  );
}
