import { useState } from 'react';
import { ArrowLeft, Sparkles, Wrench, Shield, Zap, Globe, FileText, BarChart3, Users, Eye, BookOpen, Search, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from './Logo';
import { CHANGELOG, formatReleaseDate, sortReleases, type ChangelogIcon } from '../data/changelog';

interface ChangelogPageProps {
  onBack: () => void;
}

const ICONS: Record<ChangelogIcon, LucideIcon> = {
  sparkles: Sparkles,
  wrench: Wrench,
  shield: Shield,
  zap: Zap,
  globe: Globe,
  file: FileText,
  chart: BarChart3,
  users: Users,
  eye: Eye,
  book: BookOpen,
  search: Search,
  heart: Heart,
};

const TAG_STYLES = {
  new: 'bg-emerald-100 text-emerald-700',
  fix: 'bg-amber-100 text-amber-700',
  improved: 'bg-blue-100 text-blue-700',
};

const releases = sortReleases(CHANGELOG);

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
          {releases.map((week, wi) => {
            const isExpanded = expandedWeeks.has(wi);
            const newCount = week.entries.filter(e => e.tag === 'new').length;
            const fixCount = week.entries.filter(e => e.tag === 'fix').length;
            const improvedCount = week.entries.filter(e => e.tag === 'improved').length;

            return (
              <div key={week.date} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <button
                  onClick={() => toggleWeek(wi)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      <time dateTime={week.date}>{formatReleaseDate(week.date)}</time>
                    </h2>
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
                    {week.entries.map((entry, ei) => {
                      const Icon = ICONS[entry.icon];
                      return (
                      <div key={ei} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-[#eaf4f4] flex items-center justify-center flex-shrink-0 mt-0.5 text-[#2d7d7d]">
                          <Icon className="h-4 w-4" />
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
                      );
                    })}
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
