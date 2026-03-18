import React, { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, Users, CreditCard, Search, TrendingUp } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = 'jonashjeller89@gmail.com';

interface AdminDashboardProps {
  onBack: () => void;
}

interface Stats {
  searchesToday: number;
  searchesAllTime: number;
  bySources: Record<string, number>;
  authedSearches: number;
  anonSearches: number;
  uniqueProfiles: number;
  totalUsers: number;
  signupsToday: number;
  purchasingUsers: number;
  totalRevenue: number;
  totalCreditsSold: number;
  purchases: Array<{ pack: string; amount_cents: number; credits: number; created_at: string }>;
  searchesByDay: Array<{ day: string; count: number }>;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function fetchStats() {
      try {
        const today = new Date().toISOString().slice(0, 10);

        // Fetch all data in parallel
        const [searchesRes, usersRes, purchasesRes] = await Promise.all([
          supabase.from('request_logs').select('id,source,created_at,user_id,author_id').order('created_at', { ascending: false }).limit(1000),
          supabase.from('user_credits').select('user_id,credits_remaining,total_purchased,created_at'),
          supabase.from('credit_purchases').select('pack,amount_cents,credits,created_at').order('created_at', { ascending: false }),
        ]);

        if (searchesRes.error) throw searchesRes.error;
        if (usersRes.error) throw usersRes.error;
        if (purchasesRes.error) throw purchasesRes.error;

        const searches = searchesRes.data || [];
        const users = usersRes.data || [];
        const purchases = purchasesRes.data || [];

        // Searches today
        const todaySearches = searches.filter(s => s.created_at?.startsWith(today));

        // By source
        const bySources: Record<string, number> = {};
        todaySearches.forEach(s => {
          const src = s.source || 'unknown';
          bySources[src] = (bySources[src] || 0) + 1;
        });

        // Auth vs anon
        const authed = todaySearches.filter(s => s.user_id).length;

        // Unique profiles today
        const uniqueProfiles = new Set(todaySearches.map(s => s.author_id).filter(Boolean)).size;

        // Searches by day
        const dayMap: Record<string, number> = {};
        searches.forEach(s => {
          const day = s.created_at?.slice(0, 10) || '';
          if (day) dayMap[day] = (dayMap[day] || 0) + 1;
        });
        const searchesByDay = Object.entries(dayMap)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 14)
          .map(([day, count]) => ({ day, count }));

        // Users
        const signupsToday = users.filter(u => u.created_at?.startsWith(today)).length;
        const purchasingUsers = users.filter(u => (u.total_purchased || 0) > 0).length;

        // Revenue
        const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
        const totalCreditsSold = purchases.reduce((sum, p) => sum + (p.credits || 0), 0);

        setStats({
          searchesToday: todaySearches.length,
          searchesAllTime: searches.length,
          bySources,
          authedSearches: authed,
          anonSearches: todaySearches.length - authed,
          uniqueProfiles,
          totalUsers: users.length,
          signupsToday,
          purchasingUsers,
          totalRevenue,
          totalCreditsSold,
          purchases,
          searchesByDay,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <main className="flex-1 mesh-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-sm">Not authorized</p>
          <button onClick={onBack} className="mt-4 text-sm text-[#2d7d7d] hover:underline">Go back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 mesh-bg min-h-screen">
      <nav className="border-b border-gray-200/60 bg-white/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors mr-3">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <Logo size={28} />
          <span className="font-semibold text-gray-900 text-sm tracking-tight ml-3">Admin Dashboard</span>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <StatCard icon={<Search className="h-4 w-4" />} label="Searches today" value={stats.searchesToday} />
              <StatCard icon={<BarChart3 className="h-4 w-4" />} label="All-time searches" value={stats.searchesAllTime} />
              <StatCard icon={<Users className="h-4 w-4" />} label="Registered users" value={stats.totalUsers} />
              <StatCard icon={<CreditCard className="h-4 w-4" />} label="Revenue" value={`€${stats.totalRevenue.toFixed(2)}`} />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Credits sold" value={stats.totalCreditsSold} />
            </div>

            {/* Today detail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Today's Searches</h3>
                <div className="space-y-2 text-sm">
                  <Row label="Unique profiles" value={stats.uniqueProfiles} />
                  <Row label="Authenticated" value={stats.authedSearches} />
                  <Row label="Anonymous" value={stats.anonSearches} />
                  {Object.entries(stats.bySources).map(([src, count]) => (
                    <Row key={src} label={`Source: ${src}`} value={count} />
                  ))}
                  <Row label="Signups today" value={stats.signupsToday} />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Searches by Day</h3>
                <div className="space-y-1">
                  {stats.searchesByDay.map(({ day, count }) => (
                    <div key={day} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500 w-24 text-xs">{day}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-[#2d7d7d] rounded-full"
                          style={{ width: `${Math.max((count / Math.max(...stats.searchesByDay.map(d => d.count))) * 100, 2)}%` }}
                        />
                      </div>
                      <span className="text-gray-700 font-medium w-8 text-right text-xs">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Purchases */}
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

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
