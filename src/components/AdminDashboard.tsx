import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, BarChart3, Users, CreditCard, Search, TrendingUp, UserPlus, Eye, Flag, ExternalLink, AlertTriangle, MessageSquare, Bug, Send, Mail, Loader2, X } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ADMIN_EMAIL } from '../lib/constants';

type Period = 'day' | 'week' | 'month' | 'all';
type ChartPeriod = 'week' | 'month' | 'all';

interface AdminDashboardProps {
  onBack: () => void;
}

interface RawData {
  searches: Array<{ id: string; source: string; created_at: string; user_id: string | null; author_id: string | null }>;
  users: Array<{ user_id: string; credits_remaining: number; total_purchased: number; created_at: string }>;
  purchases: Array<{ pack: string; amount_cents: number; credits: number; created_at: string }>;
  dailyStats: Array<{ day: string; total_searches: number; auth_searches: number; anon_searches: number; unique_profiles: number }>;
  feedback: Array<{ id: string; user_id: string; rating: number | null; comment: string | null; credits_granted: number; source: string; profile_viewed: string | null; created_at: string }>;
}

function getPeriodStart(period: Period): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - 6);
    return d;
  }
  // month
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - 29);
  return d;
}

function inPeriod(dateStr: string, start: Date | null): boolean {
  if (!start) return true;
  return new Date(dateStr) >= start;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { user } = useAuth();
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('week');
  const [reports, setReports] = useState<Array<{ id: string; author_id: string; author_name: string | null; reporter_email: string | null; message: string; page_url: string | null; created_at: string; resolved: boolean; resolved_note: string | null }>>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [clientErrors, setClientErrors] = useState<Array<{
    id: number; created_at: string; category: string; message: string;
    stack: string | null; component: string | null; action: string | null;
    context: Record<string, unknown>; browser: string | null; os: string | null;
    screen_size: string | null; url: string | null; session_id: string | null;
  }>>([]);
  const [errorFilter, setErrorFilter] = useState<string>('all');
  const [analyticsEvents, setAnalyticsEvents] = useState<Array<{ event: string; properties: Record<string, unknown>; referrer: string | null; session_id: string | null; created_at: string }>>([]);
  const [feedbackEmails, setFeedbackEmails] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ type: 'feedback' | 'report' | 'custom'; email: string; context?: string } | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  const userEmail = user?.email || user?.user_metadata?.email || '';
  const isAdmin = userEmail === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // Fetch all request_logs in batches to avoid Supabase row limits
        async function fetchAllLogs() {
          const allLogs: RawData['searches'] = [];
          let from = 0;
          const batchSize = 1000;
          while (true) {
            const { data, error } = await supabase
              .from('request_logs')
              .select('id,source,created_at,user_id,author_id')
              .order('created_at', { ascending: false })
              .range(from, from + batchSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allLogs.push(...data);
            if (data.length < batchSize) break;
            from += batchSize;
          }
          return allLogs;
        }

        const [searchesData, usersRes, purchasesRes, reportsRes, dailyStatsRes, feedbackRes, clientErrorsRes, analyticsRes] = await Promise.all([
          fetchAllLogs(),
          supabase.from('user_credits').select('user_id,credits_remaining,total_purchased,created_at'),
          supabase.from('credit_purchases').select('pack,amount_cents,credits,created_at').order('created_at', { ascending: false }),
          supabase.from('profile_reports').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('daily_search_stats').select('*').order('day', { ascending: true }),
          supabase.from('feedback').select('id,user_id,rating,comment,credits_granted,source,profile_viewed,created_at').order('created_at', { ascending: false }).limit(200),
          supabase.from('client_errors').select('id,created_at,category,message,stack,component,action,context,browser,os,screen_size,url,session_id').order('created_at', { ascending: false }).limit(200),
          supabase.from('analytics_events').select('event,properties,referrer,session_id,created_at').order('created_at', { ascending: false }).limit(1000),
        ]);

        if (usersRes.error) throw usersRes.error;
        if (purchasesRes.error) throw purchasesRes.error;

        setRawData({
          searches: searchesData,
          users: usersRes.data || [],
          purchases: purchasesRes.data || [],
          dailyStats: dailyStatsRes.data || [],
          feedback: feedbackRes.data || [],
        });
        if (reportsRes.data) setReports(reportsRes.data);
        if (clientErrorsRes.data) setClientErrors(clientErrorsRes.data);
        if (analyticsRes.data) setAnalyticsEvents(analyticsRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isAdmin]);

  // Resolve feedback user emails
  useEffect(() => {
    if (!rawData || rawData.feedback.length === 0) return;
    const userIds = [...new Set(rawData.feedback.map(f => f.user_id).filter(Boolean))];
    if (userIds.length === 0) return;

    async function resolveEmails() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'resolve-emails', userIds }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          setFeedbackEmails(data.emailMap || {});
        }
      } catch { /* silent */ }
    }
    resolveEmails();
  }, [rawData]);

  const sendEmail = useCallback(async () => {
    if (!replyingTo || !replySubject.trim() || !replyBody.trim()) return;
    setSendingEmail(true);
    setEmailResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            action: 'send',
            to: replyingTo.email,
            subject: replySubject,
            body: replyBody.replace(/\n/g, '<br/>'),
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Send failed');
      }
      setEmailResult({ success: true, message: `Sent to ${replyingTo.email}` });
      setTimeout(() => { setReplyingTo(null); setReplySubject(''); setReplyBody(''); setEmailResult(null); }, 2000);
    } catch (err) {
      setEmailResult({ success: false, message: err instanceof Error ? err.message : 'Failed to send' });
    } finally {
      setSendingEmail(false);
    }
  }, [replyingTo, replySubject, replyBody]);

  const stats = useMemo(() => {
    if (!rawData) return null;

    const start = getPeriodStart(period);
    const searches = rawData.searches.filter(s => s.created_at && inPeriod(s.created_at, start));
    const purchases = rawData.purchases.filter(p => p.created_at && inPeriod(p.created_at, start));
    const newUsers = rawData.users.filter(u => u.created_at && inPeriod(u.created_at, start));

    // By source
    const bySources: Record<string, number> = {};
    searches.forEach(s => {
      const src = s.source || 'unknown';
      bySources[src] = (bySources[src] || 0) + 1;
    });

    // Auth vs anon
    const authedSearches = searches.filter(s => s.user_id).length;
    const uniqueProfiles = new Set(searches.map(s => s.author_id).filter(Boolean)).size;

    // Activity by day — use daily_search_stats (persists beyond 30-day log retention)
    // Merge with today's live data from request_logs (cron aggregates yesterday at 01:00 UTC)
    const daySearchMap: Record<string, number> = {};
    rawData.dailyStats.forEach(s => {
      daySearchMap[s.day] = s.total_searches;
    });
    // Overlay today's live logs (not yet aggregated by cron)
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayLiveCount = rawData.searches.filter(s => s.created_at?.slice(0, 10) === todayStr).length;
    if (todayLiveCount > 0) {
      daySearchMap[todayStr] = Math.max(daySearchMap[todayStr] || 0, todayLiveCount);
    }
    const daySignupMap: Record<string, number> = {};
    rawData.users.forEach(u => {
      const day = u.created_at?.slice(0, 10) || '';
      if (day) daySignupMap[day] = (daySignupMap[day] || 0) + 1;
    });
    const allDays = new Set([...Object.keys(daySearchMap), ...Object.keys(daySignupMap)]);
    const activityByDay = [...allDays]
      .sort((a, b) => a.localeCompare(b))
      .map(day => ({ day, searches: daySearchMap[day] || 0, signups: daySignupMap[day] || 0 }));

    // SerpAPI usage this calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const serpApiThisMonth = rawData.searches.filter(
      s => s.source === 'serpapi' && s.created_at >= monthStart
    ).length;

    // SerpAPI share of profile loads in the selected period. A rising share means
    // the free scrape path is increasingly blocked (Google 403s) and we're leaning
    // on the paid fallback — a leading indicator of cost + reliability trouble.
    const serpApiInPeriod = bySources['serpapi'] || 0;
    const serpApiShare = searches.length > 0 ? serpApiInPeriod / searches.length : 0;

    // Revenue
    const revenue = purchases.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
    const creditsSold = purchases.reduce((sum, p) => sum + (p.credits || 0), 0);

    return {
      serpApiThisMonth,
      serpApiShare,
      serpApiInPeriod,
      searches: searches.length,
      searchesAllTime: rawData.dailyStats.reduce((sum, d) => sum + d.total_searches, 0) + todayLiveCount,
      bySources,
      authedSearches,
      anonSearches: searches.length - authedSearches,
      uniqueProfiles,
      totalUsers: rawData.users.length,
      newUsers: newUsers.length,
      purchasingUsers: rawData.users.filter(u => (u.total_purchased || 0) > 0).length,
      revenue,
      creditsSold,
      purchases,
      activityByDay,
    };
  }, [rawData, period]);

  if (!isAdmin) {
    return (
      <main className="flex-1 mesh-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-sm">Not authorized</p>
          <p className="text-gray-400 text-xs mt-1">{userEmail || 'not logged in'}</p>
          <button onClick={onBack} className="mt-4 text-sm text-[#2d7d7d] hover:underline">Go back</button>
        </div>
      </main>
    );
  }

  const periodLabels: Record<Period, string> = { day: 'Today', week: 'This Week', month: 'This Month', all: 'All Time' };

  return (
    <main className="flex-1 mesh-bg min-h-screen">
      <nav className="border-b border-gray-200/60 bg-white/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors mr-3">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <Logo size={28} />
          <span className="font-semibold text-gray-900 text-sm tracking-tight ml-3">Admin Dashboard</span>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => {
                setReplyingTo({ type: 'custom', email: '' });
                setReplySubject('');
                setReplyBody('');
                setEmailResult(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2d7d7d] hover:bg-[#2d7d7d]/10 rounded-lg transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              Compose
            </button>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {(['day', 'week', 'month', 'all'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    period === p
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-sm text-gray-500">Loading analytics...</p>
        ) : error ? (
          <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        ) : stats ? (
          <div className="space-y-8">
            {/* Top-level stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <StatCard icon={<Search className="h-4 w-4" />} label={`Searches (${periodLabels[period].toLowerCase()})`} value={stats.searches} />
              <StatCard icon={<BarChart3 className="h-4 w-4" />} label="All-time searches" value={stats.searchesAllTime} />
              <StatCard icon={<Eye className="h-4 w-4" />} label="Unique profiles" value={stats.uniqueProfiles} />
              <StatCard icon={<Users className="h-4 w-4" />} label="Total users" value={stats.totalUsers} />
              <StatCard icon={<CreditCard className="h-4 w-4" />} label={`Revenue (${periodLabels[period].toLowerCase()})`} value={`€${stats.revenue.toFixed(2)}`} />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label={`Credits sold (${periodLabels[period].toLowerCase()})`} value={stats.creditsSold} />
            </div>

            {/* SerpAPI usage */}
            {(() => {
              const limit = 250;
              const used = stats.serpApiThisMonth;
              const pct = Math.round((used / limit) * 100);
              const isWarning = used >= 200;
              const isCritical = used >= 230;
              return (
                <div className={`rounded-2xl border p-4 flex items-center gap-4 ${
                  isCritical ? 'bg-red-50 border-red-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
                }`}>
                  {(isWarning || isCritical) && <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${isCritical ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-gray-700'}`}>
                        SerpAPI Usage — {new Date().toLocaleString('en-US', { month: 'long' })}
                      </span>
                      <span className={`text-xs font-mono font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-600'}`}>
                        {used} / {limit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[#2d7d7d]'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    {isCritical && <p className="text-[10px] text-red-600 mt-1">Critical: approaching monthly limit. New lookups may fail.</p>}
                    {isWarning && !isCritical && <p className="text-[10px] text-amber-600 mt-1">Warning: 80% of monthly SerpAPI quota used.</p>}
                  </div>
                </div>
              );
            })()}

            {/* Scholar source health — SerpAPI fallback share */}
            {(() => {
              const sample = stats.searches;
              if (sample < 10) return null; // too little data to be meaningful
              const pct = Math.round(stats.serpApiShare * 100);
              const isWarning = stats.serpApiShare >= 0.4;
              const isCritical = stats.serpApiShare >= 0.6;
              const scrapeCount = sample - stats.serpApiInPeriod;
              return (
                <div className={`rounded-2xl border p-4 flex items-center gap-4 ${
                  isCritical ? 'bg-red-50 border-red-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
                }`}>
                  {(isWarning || isCritical) && <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${isCritical ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-gray-700'}`}>
                        Scholar Fallback Share — {periodLabels[period]}
                      </span>
                      <span className={`text-xs font-mono font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-600'}`}>
                        {pct}% via SerpAPI
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[#2d7d7d]'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className={`text-[10px] mt-1 ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-400'}`}>
                      {stats.serpApiInPeriod} of {sample} loads needed the paid SerpAPI fallback ({scrapeCount} from free scrape/cache).
                      {isCritical && ' Critical: the free Google Scholar scrape path is largely failing.'}
                      {isWarning && !isCritical && ' Elevated: free scraping is being blocked more than usual.'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Detail cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Search breakdown */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Search Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <Row label="Authenticated" value={stats.authedSearches} />
                  <Row label="Anonymous" value={stats.anonSearches} />
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    {Object.entries(stats.bySources)
                      .sort(([, a], [, b]) => b - a)
                      .map(([src, count]) => (
                        <Row key={src} label={src} value={count} />
                      ))}
                  </div>
                </div>
              </div>

              {/* Users */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Users</h3>
                <div className="space-y-2 text-sm">
                  <Row label="Total registered" value={stats.totalUsers} />
                  <Row label={`New (${periodLabels[period].toLowerCase()})`} value={stats.newUsers} />
                  <Row label="Paying users" value={stats.purchasingUsers} />
                  <Row label="Conversion rate" value={stats.totalUsers > 0 ? `${((stats.purchasingUsers / stats.totalUsers) * 100).toFixed(1)}%` : '0%'} />
                </div>
              </div>

              {/* Revenue */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue</h3>
                <div className="space-y-2 text-sm">
                  <Row label={`Period revenue`} value={`€${stats.revenue.toFixed(2)}`} />
                  <Row label="Period credits sold" value={stats.creditsSold} />
                  <Row label="Purchases" value={stats.purchases.length} />
                  {stats.purchases.length > 0 && (
                    <Row label="Avg purchase" value={`€${(stats.revenue / stats.purchases.length).toFixed(2)}`} />
                  )}
                </div>
              </div>
            </div>

            {/* Conversion funnel */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-6">Conversion Funnel</h3>
              <FunnelChart
                steps={[
                  { label: 'Total Searches', value: stats.searches, color: '#e0f2f1' },
                  { label: 'Unique Searchers', value: stats.newUsers + stats.anonSearches, color: '#b2dfdb' },
                  { label: 'Signed Up', value: stats.newUsers, color: '#4db6ac' },
                  { label: 'Purchased Credits', value: stats.purchasingUsers, color: '#2d7d7d' },
                ]}
              />
            </div>

            {/* Activity chart */}
            {stats.activityByDay.length > 0 && (
              <ActivityChart data={stats.activityByDay} />
            )}

            {/* Attribution & Funnel */}
            {analyticsEvents.length > 0 && (
              <AttributionSection events={analyticsEvents} />
            )}

            {/* Purchase history */}
            {stats.purchases.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Purchase History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Pack</th>
                        <th className="pb-2 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.purchases.map((p, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 text-gray-600">{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2 capitalize">{p.pack}</td>
                          <td className="py-2 font-medium">€{(p.amount_cents / 100).toFixed(2)}</td>
                          <td className="py-2">{p.credits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Error Reports */}
        {reports.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Flag className="h-4 w-4 text-red-500" />
              Profile Error Reports ({reports.length})
            </h3>
            <div className="space-y-3">
              {reports.map(report => (
                <div key={report.id} className={`border rounded-xl p-4 ${report.resolved ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 font-medium">
                        {report.author_name || report.author_id}
                        {report.resolved && <span className="ml-2 text-xs text-emerald-600 font-normal">resolved</span>}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{report.message}</p>
                      {report.resolved_note && (
                        <p className="text-xs text-emerald-700 mt-1 italic">Fix: {report.resolved_note}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {report.reporter_email && <span>{report.reporter_email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {report.reporter_email && (
                        <button
                          onClick={() => {
                            setReplyingTo({ type: 'report', email: report.reporter_email!, context: report.message });
                            setReplySubject(`Re: Profile report — ${report.author_name || report.author_id}`);
                            setReplyBody('');
                            setEmailResult(null);
                          }}
                          className="text-xs text-[#2d7d7d] hover:text-[#1f5c5c] flex items-center gap-1"
                          title="Reply via email"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {report.page_url && (
                        <a href={report.page_url} target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:text-[#1f5c5c]" title="View profile">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {!report.resolved && (
                        <button
                          onClick={() => { setResolvingId(resolvingId === report.id ? null : report.id); setResolveNote(''); }}
                          className="text-xs text-gray-500 hover:text-emerald-600 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                  {resolvingId === report.id && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={resolveNote}
                        onChange={e => setResolveNote(e.target.value)}
                        placeholder="What was fixed? (optional)"
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none"
                      />
                      <button
                        onClick={async () => {
                          await supabase.from('profile_reports').update({ resolved: true, resolved_note: resolveNote || null }).eq('id', report.id);
                          setReports(prev => prev.map(r => r.id === report.id ? { ...r, resolved: true, resolved_note: resolveNote || null } : r));
                          setResolvingId(null);
                          setResolveNote('');
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Feedback */}
        {rawData && rawData.feedback.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-[#2d7d7d]" />
              User Feedback ({rawData.feedback.length})
            </h3>
            <div className="space-y-3">
              {rawData.feedback.map(fb => {
                const email = feedbackEmails[fb.user_id];
                return (
                  <div key={fb.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {fb.rating && (
                          <p className="text-sm mb-1">
                            {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                          </p>
                        )}
                        {fb.comment && (
                          <p className="text-sm text-gray-700">{fb.comment}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{new Date(fb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {email && <span className="text-gray-500">{email}</span>}
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{fb.source}</span>
                          {fb.credits_granted > 0 && (
                            <span className="text-emerald-600">+{fb.credits_granted} credits</span>
                          )}
                          {fb.profile_viewed && (
                            <a
                              href={`?user=${fb.profile_viewed}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2d7d7d] hover:underline"
                            >
                              {fb.profile_viewed}
                            </a>
                          )}
                        </div>
                      </div>
                      {email && (
                        <button
                          onClick={() => {
                            setReplyingTo({ type: 'feedback', email, context: fb.comment || '' });
                            setReplySubject('Re: Your ScholarFolio feedback');
                            setReplyBody('');
                            setEmailResult(null);
                          }}
                          className="text-xs text-[#2d7d7d] hover:text-[#1f5c5c] flex items-center gap-1 flex-shrink-0"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Reply
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Client Error Log */}
        {clientErrors.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Bug className="h-4 w-4 text-red-500" />
                Client Errors ({clientErrors.length})
              </h3>
              <div className="flex gap-1">
                {['all', 'pindex', 'profile', 'openalex', 's2', 'auth', 'unhandled'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setErrorFilter(cat)}
                    className={`px-2 py-0.5 text-[10px] rounded-full ${errorFilter === cat ? 'bg-red-100 text-red-700 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {clientErrors
                .filter(e => errorFilter === 'all' || e.category === errorFilter)
                .map(err => (
                <div key={err.id} className="border border-gray-100 rounded-lg p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          err.category === 'pindex' ? 'bg-violet-100 text-violet-700' :
                          err.category === 'profile' ? 'bg-red-100 text-red-700' :
                          err.category === 'unhandled' ? 'bg-red-200 text-red-800' :
                          err.category === 's2' ? 'bg-teal-100 text-teal-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {err.category}
                        </span>
                        {err.action && <span className="text-gray-400">{err.action}</span>}
                        {err.component && <span className="text-gray-300">in {err.component}</span>}
                      </div>
                      <p className="text-gray-700 font-mono break-all">{err.message}</p>
                      {err.context && Object.keys(err.context).length > 0 && (
                        <p className="text-gray-400 mt-1 font-mono text-[10px] break-all">
                          {JSON.stringify(err.context)}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 text-[10px] text-gray-400 space-y-0.5">
                      <p>{new Date(err.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      {err.browser && <p>{err.browser}</p>}
                      {err.os && <p>{err.os}</p>}
                      {err.screen_size && <p>{err.screen_size}</p>}
                    </div>
                  </div>
                  {err.stack && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">Stack trace</summary>
                      <pre className="mt-1 text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto bg-gray-50 p-2 rounded">
                        {err.stack}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Email compose modal */}
      {replyingTo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#2d7d7d]" />
                {replyingTo.type === 'custom' ? 'Compose Email' : 'Reply'}
              </h3>
              <button onClick={() => { setReplyingTo(null); setEmailResult(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {replyingTo.context && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 italic border-l-2 border-gray-200">
                  {replyingTo.context}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                {replyingTo.type === 'custom' ? (
                  <input
                    type="email"
                    value={replyingTo.email}
                    onChange={e => setReplyingTo({ ...replyingTo, email: e.target.value })}
                    placeholder="recipient@example.com"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none"
                  />
                ) : (
                  <p className="text-sm text-gray-700">{replyingTo.email}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                <input
                  type="text"
                  value={replySubject}
                  onChange={e => setReplySubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none resize-none"
                  placeholder="Type your message..."
                />
              </div>
              <p className="text-[10px] text-gray-400">Sent from info@scholarfolio.org via Resend</p>
              {emailResult && (
                <p className={`text-xs px-3 py-2 rounded-lg ${emailResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {emailResult.message}
                </p>
              )}
              <button
                onClick={sendEmail}
                disabled={sendingEmail || !replyingTo.email || !replySubject.trim() || !replyBody.trim()}
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
      <div className="flex items-center gap-2 text-[#2d7d7d] mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function FunnelChart({ steps }: { steps: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...steps.map(s => s.value), 1);
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const widthPct = Math.max((step.value / max) * 100, 8);
        const prevValue = i > 0 ? steps[i - 1].value : null;
        const dropRate = prevValue && prevValue > 0 ? ((1 - step.value / prevValue) * 100).toFixed(0) : null;
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 font-medium">{step.label}</span>
              <div className="flex items-center gap-2">
                {dropRate !== null && (
                  <span className="text-[10px] text-gray-400">-{dropRate}%</span>
                )}
                <span className="text-sm font-bold text-gray-900">{step.value.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-center">
              <div
                className="h-8 rounded-lg transition-all duration-500"
                style={{ width: `${widthPct}%`, backgroundColor: step.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function ActivityChart({ data }: { data: Array<{ day: string; searches: number; signups: number }> }) {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const filteredData = useMemo(() => {
    if (chartPeriod === 'all') return data;
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (chartPeriod === 'week') cutoff.setDate(cutoff.getDate() - 6);
    else cutoff.setDate(cutoff.getDate() - 29);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.filter(d => d.day >= cutoffStr);
  }, [data, chartPeriod]);

  const maxValue = Math.max(...filteredData.map(d => d.searches + d.signups), 1);
  const hasSignups = filteredData.some(d => d.signups > 0);
  const totalSearches = filteredData.reduce((s, d) => s + d.searches, 0);
  const totalSignups = filteredData.reduce((s, d) => s + d.signups, 0);
  const hoveredData = hoveredIdx !== null ? filteredData[hoveredIdx] : null;

  const chartPeriodLabels: Record<ChartPeriod, string> = { week: '7 days', month: '30 days', all: 'All time' };

  // Calculate bar width based on number of days
  const barCount = filteredData.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Daily Activity</h3>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['week', 'month', 'all'] as ChartPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setChartPeriod(p)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                chartPeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {chartPeriodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Hover detail or summary */}
      <div className="h-8 mb-2">
        {hoveredData ? (
          <div className="flex items-center gap-4 text-xs animate-in fade-in duration-100">
            <span className="font-semibold text-gray-900">{formatDay(hoveredData.day)}</span>
            <span className="text-[#2d7d7d] font-medium">{hoveredData.searches} searches</span>
            {hoveredData.signups > 0 && (
              <span className="text-violet-600 font-medium">{hoveredData.signups} sign-ups</span>
            )}
            <span className="text-gray-400">Total: {hoveredData.searches + hoveredData.signups}</span>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{totalSearches} searches</span>
            {totalSignups > 0 && <span>{totalSignups} sign-ups</span>}
            <span>over {filteredData.length} days</span>
            <span className="ml-auto">Hover over bars for details</span>
          </div>
        )}
      </div>

      {/* Column chart */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between h-48 absolute left-0 top-0 bottom-6 text-[10px] text-gray-400 w-8">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue / 2)}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-10">
          {/* Grid lines */}
          <div className="relative h-48 border-b border-gray-100">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-t border-gray-50 w-full" />
              <div className="border-t border-dashed border-gray-100 w-full" />
              <div />
            </div>

            {/* Bars */}
            <div
              className="absolute inset-0 flex items-end"
              style={{ gap: barCount > 60 ? '0px' : barCount > 30 ? '1px' : '2px' }}
            >
              {filteredData.map((d, i) => {
                const searchHeight = (d.searches / maxValue) * 100;
                const signupHeight = (d.signups / maxValue) * 100;
                const isHovered = hoveredIdx === i;
                return (
                  <div
                    key={d.day}
                    className="flex-1 flex flex-col justify-end h-full cursor-pointer group relative"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {d.signups > 0 && (
                      <div
                        className={`w-full rounded-t transition-all duration-150 ${isHovered ? 'bg-violet-500' : 'bg-violet-400'}`}
                        style={{ height: `${Math.max(signupHeight, 1)}%`, minHeight: '2px' }}
                      />
                    )}
                    <div
                      className={`w-full transition-all duration-150 ${
                        isHovered ? 'bg-[#1f5c5c]' : 'bg-[#2d7d7d]'
                      } ${d.signups > 0 ? '' : 'rounded-t'}`}
                      style={{ height: `${Math.max(searchHeight, 0.5)}%`, minHeight: d.searches > 0 ? '2px' : '0px' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
            {filteredData.length > 0 && (
              <>
                <span>{formatDay(filteredData[0].day)}</span>
                {filteredData.length > 14 && (
                  <span>{formatDay(filteredData[Math.floor(filteredData.length / 2)].day)}</span>
                )}
                <span>{formatDay(filteredData[filteredData.length - 1].day)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-[#2d7d7d] inline-block" />
          Searches
        </span>
        {hasSignups && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded bg-violet-400 inline-block" />
            Sign-ups
          </span>
        )}
      </div>

      {/* Note about log retention */}
      <div className="flex items-start gap-2 mt-3 p-2 bg-amber-50 rounded-lg">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-600">Raw search logs are retained for 30 days (GDPR). Aggregated daily counts are retained permanently.</p>
      </div>
    </div>
  );
}

function AttributionSection({ events }: { events: Array<{ event: string; properties: Record<string, unknown>; referrer: string | null; session_id: string | null; created_at: string }> }) {
  // Parse referrer into a readable source
  function parseSource(referrer: string | null, props: Record<string, unknown>): string {
    if (props.utm_source) return String(props.utm_source);
    if (!referrer || referrer === 'direct') return 'Direct';
    try {
      const host = new URL(referrer).hostname.replace('www.', '');
      if (host.includes('google')) return 'Google';
      if (host.includes('twitter') || host.includes('x.com')) return 'Twitter/X';
      if (host.includes('linkedin')) return 'LinkedIn';
      if (host.includes('facebook')) return 'Facebook';
      if (host.includes('reddit')) return 'Reddit';
      if (host.includes('t.co')) return 'Twitter/X';
      return host;
    } catch {
      return referrer.slice(0, 30);
    }
  }

  const visits = events.filter(e => e.event === 'visit');
  const signups = events.filter(e => e.event === 'signup');
  const searches = events.filter(e => e.event === 'search');
  const signupWalls = events.filter(e => e.event === 'signup_wall_shown');
  const creditWalls = events.filter(e => e.event === 'credit_wall_shown');

  // Traffic sources
  const sourceCounts: Record<string, number> = {};
  visits.forEach(v => {
    const src = parseSource(v.referrer, v.properties);
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const sortedSources = Object.entries(sourceCounts).sort(([, a], [, b]) => b - a);

  // Signup sources (from the signup event's attribution)
  const signupSources: Record<string, number> = {};
  signups.forEach(s => {
    const src = parseSource(null, s.properties);
    const key = s.properties._utm_source ? String(s.properties._utm_source) : (s.properties._referrer ? parseSource(String(s.properties._referrer), {}) : 'Direct');
    signupSources[key] = (signupSources[key] || 0) + 1;
  });
  const sortedSignupSources = Object.entries(signupSources).sort(([, a], [, b]) => b - a);

  // Unique sessions
  const uniqueSessions = new Set(visits.map(v => v.session_id).filter(Boolean)).size;

  // Funnel: visits → searches → signup_wall → signups
  const funnelSearchSessions = new Set(searches.map(s => s.session_id).filter(Boolean)).size;
  const funnelWallSessions = new Set(signupWalls.map(s => s.session_id).filter(Boolean)).size;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-5">
        <TrendingUp className="h-4 w-4 text-[#2d7d7d]" />
        Attribution & Funnel
        <span className="text-[10px] text-gray-400 font-normal ml-auto">Tracking since deployment</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Traffic Sources */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Traffic Sources</h4>
          <div className="space-y-2 text-sm">
            <Row label="Unique sessions" value={uniqueSessions} />
            <div className="border-t border-gray-100 pt-2 mt-2" />
            {sortedSources.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No data yet — tracking starts now</p>
            ) : (
              sortedSources.slice(0, 10).map(([src, count]) => (
                <Row key={src} label={src} value={count} />
              ))
            )}
          </div>
        </div>

        {/* Signup Attribution */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Signup Sources</h4>
          <div className="space-y-2 text-sm">
            <Row label="Total signups tracked" value={signups.length} />
            <div className="border-t border-gray-100 pt-2 mt-2" />
            {sortedSignupSources.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No signups tracked yet</p>
            ) : (
              sortedSignupSources.map(([src, count]) => (
                <Row key={src} label={src} value={count} />
              ))
            )}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Session Funnel</h4>
          <div className="space-y-2 text-sm">
            <Row label="Visits" value={visits.length} />
            <Row label="Searched" value={`${funnelSearchSessions} sessions`} />
            <Row label="Hit signup wall" value={`${funnelWallSessions} sessions`} />
            <Row label="Hit credit wall" value={`${creditWalls.length} times`} />
            <Row label="Signed up" value={signups.length} />
            {visits.length > 0 && signups.length > 0 && (
              <div className="border-t border-gray-100 pt-2 mt-2">
                <Row label="Visit → signup" value={`${((signups.length / uniqueSessions) * 100).toFixed(1)}%`} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
