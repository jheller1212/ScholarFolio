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
  entries: ChangelogEntry[];
}

const TAG_STYLES = {
  new: 'bg-emerald-100 text-emerald-700',
  fix: 'bg-amber-100 text-amber-700',
  improved: 'bg-blue-100 text-blue-700',
};

const changelog: ChangelogWeek[] = [
  {
    label: 'June 2–4, 2026',
    date: 'This week',
    entries: [
      { icon: <FileText className="h-4 w-4" />, text: 'Narrative CV export (Beta) — one-click Word export for NWO, ERC, and MSCA grant formats, pre-filled from your Scholar profile and ORCID', tag: 'new' },
      { icon: <FileText className="h-4 w-4" />, text: 'Narrative CV now includes research themes, co-author network, geographic collaboration, citation distribution, and field-normalized metrics', tag: 'improved' },
      { icon: <FileText className="h-4 w-4" />, text: 'Auto-fill CV from ORCID: education, employment, grants, and awards pulled automatically', tag: 'new' },
      { icon: <FileText className="h-4 w-4" />, text: 'Smarter theme extraction — bigram-based, with proper handling of surname prefixes, Dutch/German stop words, and discipline-aware language', tag: 'improved' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'P-Index — thought leadership metric by Pham, Wu & Wang (2024, JCR) measuring citation percentile rank within journal and year, with Abbas (2011) authorship weighting', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Publication review step before P-Index calculation — filter misattributed papers before scoring', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Field-normalized metrics: FWCI, mean citedness, and Relative Citation Ratio from OpenAlex', tag: 'new' },
      { icon: <Shield className="h-4 w-4" />, text: 'Full GDPR compliance: account deletion, JSON data export, 30-day log retention, privacy policy with international transfer disclosures', tag: 'new' },
      { icon: <Zap className="h-4 w-4" />, text: '40% bundle size reduction (1.9MB → 1.15MB) through code splitting and lazy loading', tag: 'improved' },
      { icon: <Eye className="h-4 w-4" />, text: 'ARIA-compliant modals and tabs, keyboard navigation, dark mode improvements across all components', tag: 'improved' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Fixed co-author network crash caused by variable shadowing', tag: 'fix' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Fixed credit system race conditions with database-level rate limiting', tag: 'fix' },
      { icon: <Shield className="h-4 w-4" />, text: 'Anti-scraping protections: robots.txt blocking AI crawlers, X-Robots-Tag headers', tag: 'new' },
    ],
  },
  {
    label: 'May 19–22, 2026',
    date: '2 weeks ago',
    entries: [
      { icon: <Users className="h-4 w-4" />, text: 'Redesigned user menu with Radix UI dropdown', tag: 'improved' },
    ],
  },
  {
    label: 'May 12–18, 2026',
    date: '3 weeks ago',
    entries: [
      { icon: <Globe className="h-4 w-4" />, text: 'World map prefetches geo data on profile load for instant tab switching', tag: 'improved' },
      { icon: <Globe className="h-4 w-4" />, text: 'Consolidated OpenAlex author lookup into shared cached service', tag: 'improved' },
      { icon: <Globe className="h-4 w-4" />, text: 'Fixed world map on mobile: touch support, timeout handling, responsive legend', tag: 'fix' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Fixed OpenAlex author matching — prioritize display_name match over search rank', tag: 'fix' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Fixed RCR data — iCite API only supports PMIDs, not DOIs', tag: 'fix' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Field-normalized metrics card: FWCI, mean journal impact, and RCR on one card', tag: 'new' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Safari compatibility fixes and increased co-author map to 50 connections', tag: 'fix' },
      { icon: <Eye className="h-4 w-4" />, text: 'Updated About page with current features, data sources, and pricing', tag: 'improved' },
      { icon: <Sparkles className="h-4 w-4" />, text: 'Semantic color accents and expanded landing page feature cards', tag: 'improved' },
    ],
  },
  {
    label: 'May 7–11, 2026',
    date: '4 weeks ago',
    entries: [
      { icon: <Globe className="h-4 w-4" />, text: 'Co-author World Map — interactive globe showing geographic distribution of collaborators with OpenAlex institution data', tag: 'new' },
      { icon: <Globe className="h-4 w-4" />, text: 'Continent coloring, zoom controls, and region presets for the world map', tag: 'improved' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Fixed author name deduplication for surname prefix variations (van, de, von)', tag: 'fix' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Fixed world map showing wrong institutions, self as co-author, and arcs wrapping around globe', tag: 'fix' },
    ],
  },
  {
    label: 'April 26–27, 2026',
    date: '5 weeks ago',
    entries: [
      { icon: <Sparkles className="h-4 w-4" />, text: 'Visual redesign: skeleton loaders, animations, and dark mode foundation', tag: 'improved' },
      { icon: <Users className="h-4 w-4" />, text: 'Claim your profile — vanity URLs (scholarfolio.org/profile/yourname) with verified badge', tag: 'new' },
      { icon: <Users className="h-4 w-4" />, text: 'Share snippets after claiming a profile for easy social sharing', tag: 'new' },
      { icon: <Users className="h-4 w-4" />, text: 'Collaboration insights panel in co-author network — top collaborators, one-time collaborator impact', tag: 'new' },
      { icon: <BookOpen className="h-4 w-4" />, text: 'Error reporting for research profile narratives with admin resolution workflow', tag: 'new' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Fixed network text overlap and node crowding', tag: 'fix' },
      { icon: <Zap className="h-4 w-4" />, text: 'Claimed profiles served from cache to avoid unnecessary API costs', tag: 'improved' },
    ],
  },
  {
    label: 'March 18–20, 2026',
    date: '~11 weeks ago',
    entries: [
      { icon: <BookOpen className="h-4 w-4" />, text: 'Open Science tab — per-publication OA badges, OA trend chart, ORCID integration via OpenAlex', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Admin dashboard with time filters, conversion funnel, and search analytics', tag: 'new' },
      { icon: <Shield className="h-4 w-4" />, text: 'Security hardening: fixed critical and high severity issues from code review', tag: 'fix' },
      { icon: <Wrench className="h-4 w-4" />, text: 'Fixed email sign-up flow and Google OAuth duplicate account handling', tag: 'fix' },
      { icon: <Sparkles className="h-4 w-4" />, text: 'Interactive OA trend chart with hover breakdown', tag: 'improved' },
    ],
  },
  {
    label: 'March 5–7, 2026',
    date: 'Launch week',
    entries: [
      { icon: <Sparkles className="h-4 w-4" />, text: 'ScholarFolio launched — paste any Google Scholar URL to generate a visual academic portfolio', tag: 'new' },
      { icon: <BarChart3 className="h-4 w-4" />, text: 'Impact metrics: h-index, g-index, i10-index, citation trends, collaboration scores', tag: 'new' },
      { icon: <Users className="h-4 w-4" />, text: 'Interactive co-author network with D3.js force graph, cluster detection, and bridge author identification', tag: 'new' },
      { icon: <FileText className="h-4 w-4" />, text: 'Auto-generated researcher narrative summarizing career, themes, and impact', tag: 'new' },
      { icon: <BookOpen className="h-4 w-4" />, text: 'Publication list with sortable columns and journal ranking badges', tag: 'new' },
      { icon: <Zap className="h-4 w-4" />, text: 'PDF export of full portfolio', tag: 'new' },
      { icon: <Shield className="h-4 w-4" />, text: 'Supabase edge functions for secure Google Scholar scraping via SerpAPI', tag: 'new' },
    ],
  },
];

export function ChangelogPage({ onBack }: ChangelogPageProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0, 1, 2]));

  const toggleWeek = (idx: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const totalUpdates = changelog.reduce((sum, w) => sum + w.entries.length, 0);

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
            {totalUpdates} updates shipped since launch. ScholarFolio is actively developed — new features land every week.
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
                    <p className="text-xs text-gray-400 mt-0.5">{week.date}</p>
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
