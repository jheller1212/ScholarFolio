import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Eye, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';
import { fetchTrendingProfiles, fetchTotalViewCount, type TrendingProfile } from '../services/profile-views';

type TimeRange = '7' | '30' | '0';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7': '7 days',
  '30': '30 days',
  '0': 'All time',
};

interface TrendingPageProps {
  onBack: () => void;
}

export function TrendingPage({ onBack }: TrendingPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [profiles, setProfiles] = useState<TrendingProfile[]>([]);
  const [totalViews, setTotalViews] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const days = parseInt(timeRange, 10);

    Promise.all([
      fetchTrendingProfiles(days, 20),
      fetchTotalViewCount(days),
    ]).then(([profilesResult, viewCount]) => {
      if (!cancelled) {
        setProfiles(profilesResult);
        setTotalViews(viewCount);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [timeRange]);

  return (
    <main className="flex-1 min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="border-b border-gray-200/60 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <Logo size={28} />
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm tracking-tight">Scholar Folio</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-6 w-6 text-[#2d7d7d]" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trending Profiles</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Most-viewed researcher profiles on Scholar Folio
        </p>

        {/* Stats + Time range */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-2 bg-[#eaf4f4] dark:bg-[#2d7d7d]/10 border border-[#2d7d7d]/20 rounded-xl px-4 py-2.5">
            <Eye className="h-4 w-4 text-[#2d7d7d]" />
            <span className="text-sm font-semibold text-[#2d7d7d]">
              {loading ? '—' : totalViews.toLocaleString()}
            </span>
            <span className="text-sm text-[#2d7d7d]/70">
              {timeRange === '0' ? 'total views' : `views in ${TIME_RANGE_LABELS[timeRange]}`}
            </span>
          </div>

          <div className="flex items-center gap-1 ml-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
            {(Object.entries(TIME_RANGE_LABELS) as [TimeRange, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTimeRange(value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                  timeRange === value
                    ? 'bg-[#2d7d7d] text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-[#2d7d7d] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-20 text-center">
              <TrendingUp className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No profile views recorded yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Come back after some profiles have been visited</p>
            </div>
          ) : (
            <ul>
              {profiles.map((profile, index) => (
                <li
                  key={profile.scholar_id}
                  className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Rank */}
                  <span className={`text-sm font-bold w-6 text-center shrink-0 ${
                    index === 0 ? 'text-amber-500' :
                    index === 1 ? 'text-gray-400' :
                    index === 2 ? 'text-amber-700' :
                    'text-gray-400 dark:text-gray-500'
                  }`}>
                    {index + 1}
                  </span>

                  {/* Author info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {profile.author_name ?? 'Unknown Author'}
                    </p>
                    {profile.affiliation && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {profile.affiliation}
                      </p>
                    )}
                  </div>

                  {/* View count */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {profile.view_count.toLocaleString()}
                    </span>
                  </div>

                  {/* View profile button */}
                  <a
                    href={`/?user=${encodeURIComponent(profile.scholar_id)}`}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2d7d7d] text-white hover:bg-[#25696a] transition-colors"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
