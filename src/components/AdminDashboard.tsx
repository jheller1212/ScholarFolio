import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, BarChart3, Users, CreditCard, Search, TrendingUp, UserPlus, Eye, Flag, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = 'jonasheller89@gmail.com';

type Period = 'day' | 'week' | 'month' | 'all';

interface AdminDashboardProps {
  onBack: () => void;
}

interface RawData {
  searches: Array<{ id: string; source: string; created_at: string; user_id: string | null; author_id: string | null }>;
  users: Array<{ user_id: string; credits_remaining: number; total_purchased: number; created_at: string }>;
  purchases: Array<{ pack: string; amount_cents: number; credits: number; created_at: string }>;
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

  const userEmail = user?.email || user?.user_metadata?.email || '';
  const isAdmin = userEmail === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [searchesRes, usersRes, purchasesRes, reportsRes] = await Promise.all([
          supabase.from('request_logs').select('id,source,created_at,user_id,author_id').order('created_at', { ascending: false }).limit(5000),
          supabase.from('user_credits').select('user_id,credits_remaining,total_purchased,created_at'),
          supabase.from('credit_purchases').select('pack,amount_cents,credits,created_at').order('created_at', { ascending: false }),
          supabase.from('profile_reports').select('*').order('created_at', { ascending: false }).limit(100),
        ]);

        if (searchesRes.error) throw searchesRes.error;
        if (usersRes.error) throw usersRes.error;
        if (purchasesRes.error) throw purchasesRes.error;

        setRawData({
          searches: searchesRes.data || [],
          users: usersRes.data || [],
          purchases: purchasesRes.data || [],
        });
        if (reportsRes.data) setReports(reportsRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isAdmin]);

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

    // Searches by day
    const dayMap: Record<string, number> = {};
    searches.forEach(s => {
      const day = s.created_at?.slice(0, 10) || '';
      if (day) dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const searchesByDay = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }));

    // Revenue
    const revenue = purchases.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
    const creditsSold = purchases.reduce((sum, p) => sum + (p.credits || 0), 0);

    return {
      searches: searches.length,
      searchesAllTime: rawData.searches.length,
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
      searchesByDay,
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
          <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
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
                  { label: 'Total Searches', value: stats.searchesAllTime, color: '#e0f2f1' },
                  { label: 'Unique Searchers', value: stats.totalUsers + stats.anonSearches, color: '#b2dfdb' },
                  { label: 'Signed Up', value: stats.totalUsers, color: '#4db6ac' },
                  { label: 'Purchased Credits', value: stats.purchasingUsers, color: '#2d7d7d' },
                ]}
              />
            </div>

            {/* Searches chart */}
            {stats.searchesByDay.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Searches by Day</h3>
                <div className="space-y-1">
                  {stats.searchesByDay.map(({ day, count }) => {
                    const max = Math.max(...stats.searchesByDay.map(d => d.count));
                    return (
                      <div key={day} className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 w-20 text-xs shrink-0">{formatDay(day)}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full bg-[#2d7d7d] rounded-full transition-all duration-300"
                            style={{ width: `${Math.max((count / max) * 100, 2)}%` }}
                          />
                        </div>
                        <span className="text-gray-700 font-medium w-8 text-right text-xs">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
      </div>
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
