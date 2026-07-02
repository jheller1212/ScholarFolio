import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Wrench, Shield, Zap, Globe, FileText, BarChart3, Users, Eye, BookOpen } from 'lucide-react';
import { Logo } from './Logo';

interface ChangelogPageProps {
  onBack: () => void;
}

interface ChangelogEntry {
  icon: React.ReactNode;
  text: string;
  tag?: 'new' | 'fix' | 'improved';
}

interface ChangelogWeek {
  label: string;
  date: string;
  headline: string;
  entries: ChangelogEntry[];
}

const TAG_STYLES = {
  new: 'bg-emerald-100 text-emerald-700',
  fix: 'bg-amber-100 text-amber-700',
  improved: 'bg-blue-100 text-blue-700',
};

const changelog: ChangelogWeek[] = [
  {
    label: 'June 30 – July 2, 2026',
    date: 'This week',
    headline: 'Smarter metrics, faster profiles, transparency report',
    entries: [
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Top 10% Papers metric — the share of your works in the top decile of their field’s citation distribution, as used in the Leiden Ranking', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'FWCI upgraded to OpenAlex’s native field-weighted citation impact, reported as the median across your papers — now comparable across disciplines', tag: 'improved' },
      { icon: <Eye className="h-4 w-4" />, text: 'Transparency report on the About page now shows real revenue and cost figures, refreshed automatically every quarter', tag: 'new' },
      { icon: <Zap className="h-4 w-4" />, text: 'Faster profile loads — publication data is fetched once and pages load in parallel', tag: 'improved' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Mean Journal Impact now displays correctly (it was silently empty), and metric values no longer lose their % or unit at the end of the count-up animation', tag: 'fix' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Also: more accurate top-venue counts (journal name variants folded together), loading skeletons for field-normalized metrics, and more reliable publication data fetching', tag: 'fix' },
    ],
  },
  {
    label: 'June 16, 2026',
    date: '2 weeks ago',
    headline: 'Fallback profiles, healthier data pipeline',
    entries: [
      { icon: <BookOpen className="h-4 w-4" />, text: 'Fallback profiles — when Google Scholar is unavailable, a profile can be built from OpenAlex data instead, free to view', tag: 'new' },
      { icon: <Shield className="h-4 w-4" />, text: 'Data-source health monitoring with failure-rate alerts, so outages get caught early', tag: 'new' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Cleaner error logging — cancelled requests are no longer reported as errors', tag: 'fix' },
    ],
  },
  {
    label: 'June 2–6, 2026',
    date: '4 weeks ago',
    headline: 'Semantic Scholar, Narrative CV export, P-Index',
    entries: [
      { icon: <BookOpen className="h-4 w-4" />, text: 'Semantic Scholar integration — see influential citation counts and AI-generated TLDRs on your publications', tag: 'new' },
      { icon: <FileText className="h-4 w-4" />, text: 'Narrative CV export — one-click Word download formatted for NWO, ERC, and MSCA grants, with ORCID auto-fill', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'P-Index calculator with field-normalized metrics (FWCI, RCR) and publication review step', tag: 'new' },
      { icon: <Shield className="h-4 w-4" />, text: 'GDPR compliance — account deletion, data export, password reset, and cookie disclosure', tag: 'new' },
      { icon: <Zap className="h-4 w-4" />, text: '40% smaller bundle, dark mode polish, and keyboard accessibility improvements', tag: 'improved' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Also: monthly free credit, credits badge redesign, About page rewrite, error logging, staging environment, and various bug fixes', tag: 'fix' },
    ],
  },
  {
    label: 'May 7–22, 2026',
    date: '7 weeks ago',
    headline: 'Co-author World Map, field metrics',
    entries: [
      { icon: <Globe className="h-4 w-4" />, text: 'Co-author World Map — interactive globe showing where your collaborators are based, with continent coloring and region presets', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Field-normalized metrics card — FWCI, mean journal impact, and Relative Citation Ratio', tag: 'new' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Also: mobile touch support for world map, redesigned user menu, author name deduplication for Dutch/German prefixes, Safari fixes', tag: 'fix' },
    ],
  },
  {
    label: 'April 26–27, 2026',
    date: '9 weeks ago',
    headline: 'Claim your profile, visual redesign',
    entries: [
      { icon: <Users className="h-4 w-4" />, text: 'Claim your profile — get a vanity URL (scholarfolio.org/yourname) with verified badge and share snippets', tag: 'new' },
      { icon: <Sparkles className="h-4 w-4" />, text: 'Visual redesign — skeleton loaders, page transitions, dark mode, and collaboration insights panel', tag: 'improved' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Also: error reporting for narratives, admin resolution workflow', tag: 'fix' },
    ],
  },
  {
    label: 'March 18–20, 2026',
    date: '~15 weeks ago',
    headline: 'Open Science tab, admin dashboard',
    entries: [
      { icon: <BookOpen className="h-4 w-4" />, text: 'Open Science tab — per-publication OA badges, interactive OA trend chart, ORCID integration via OpenAlex', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Admin dashboard with usage analytics and conversion funnel', tag: 'new' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Also: security hardening, auth flow fixes', tag: 'fix' },
    ],
  },
  {
    label: 'March 5–7, 2026',
    date: 'Launch week',
    headline: 'ScholarFolio launched',
    entries: [
      { icon: <Sparkles className="h-4 w-4" />, text: 'ScholarFolio launched — paste any Google Scholar URL to generate a visual academic portfolio', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Impact metrics, citation trends, interactive co-author network, and auto-generated researcher narrative', tag: 'new' },
      { icon: <BookOpen className="h-4 w-4" />, text: 'Sortable publication list with journal ranking badges and PDF export', tag: 'new' },
    ],
  },
];

export function ChangelogPage({ onBack }: ChangelogPageProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0, 1]));

  const toggleWeek = (idx: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <main className="flex-1 mesh-bg min-h-screen">
      <nav className="border-b border-gray-200/60 bg-white/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors mr-3">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <Logo size={28} />
          <span className="font-semibold text-gray-900 text-sm tracking-tight ml-3">Changelog</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">What's New</h1>
          <p className="text-sm text-gray-500">
            ScholarFolio is actively developed. Here's what shipped since launch.
          </p>
        </div>

        <div className="space-y-4">
          {changelog.map((week, wi) => {
            const isExpanded = expandedWeeks.has(wi);
            const newCount = week.entries.filter(e => e.tag === 'new').length;
            const fixCount = week.entries.filter(e => e.tag === 'fix').length;
            const improvedCount = week.entries.filter(e => e.tag === 'improved').length;

            return (
              <div key={wi} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <button
                  onClick={() => toggleWeek(wi)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{week.label}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{week.headline}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {newCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full">
                        {newCount} new
                      </span>
                    )}
                    {improvedCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded-full">
                        {improvedCount} improved
                      </span>
                    )}
                    {fixCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                        {fixCount} fixed
                      </span>
                    )}
                    <svg
                      className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-5 space-y-3 border-t border-gray-50 pt-4">
                    {week.entries.map((entry, ei) => (
                      <div key={ei} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-[#eaf4f4] flex items-center justify-center flex-shrink-0 mt-0.5 text-[#2d7d7d]">
                          {entry.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 leading-relaxed">{entry.text}</p>
                        </div>
                        {entry.tag && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 mt-0.5 ${TAG_STYLES[entry.tag]}`}>
                            {entry.tag}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
