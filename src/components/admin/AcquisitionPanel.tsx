import { useEffect, useMemo, useState } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FUNNEL_STEPS, funnelCounts, landingsFrom, tally, type AnalyticsRow } from '../../lib/acquisition';

type WindowDays = 7 | 30 | 90;
const WINDOWS: WindowDays[] = [7, 30, 90];
const BATCH = 1000;
const FIELDS = 'event,pathname,properties,referrer,session_id,created_at';

const STEP_LABELS: Record<(typeof FUNNEL_STEPS)[number], string> = {
  visit: 'Visit',
  search: 'Search',
  profile_view: 'Profile view',
  signup: 'Sign-up',
  claim_started: 'Claim started',
  claim_completed: 'Claim completed',
};

// Only the events the panel needs. In-app page_views are excluded (they are
// high-volume); only guide landings are fetched, because the static guides
// log no `visit` row of their own.
async function fetchRows(since: string): Promise<AnalyticsRow[]> {
  const rows: AnalyticsRow[] = [];
  const nonPageView = FUNNEL_STEPS as readonly string[];
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase.from('analytics_events').select(FIELDS)
      .in('event', nonPageView).gte('created_at', since)
      .order('created_at', { ascending: false }).range(from, from + BATCH - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as AnalyticsRow[]));
    if (!data || data.length < BATCH) break;
  }
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase.from('analytics_events').select(FIELDS)
      .eq('event', 'page_view').eq('properties->>landing', 'true').gte('created_at', since)
      .order('created_at', { ascending: false }).range(from, from + BATCH - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as AnalyticsRow[]));
    if (!data || data.length < BATCH) break;
  }
  return rows;
}

/**
 * Where sessions land and where they came from, plus a session funnel. Loads
 * the widest window (90 days) once and filters client-side for 7/30.
 */
export function AcquisitionPanel() {
  const [rows, setRows] = useState<AnalyticsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<WindowDays>(30);

  useEffect(() => {
    const since = new Date(Date.now() - 90 * 86400e3).toISOString();
    fetchRows(since)
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load analytics'));
  }, []);

  const view = useMemo(() => {
    if (!rows) return null;
    const since = new Date(Date.now() - days * 86400e3).toISOString();
    const inWindow = rows.filter(r => r.created_at >= since);
    const landings = landingsFrom(inWindow);
    return {
      total: landings.length,
      byPageType: tally(landings, l => l.pageType),
      byReferrer: tally(landings, l => l.referrerHost).slice(0, 12),
      byUtmSource: tally(landings.filter(l => l.utmSource !== '(none)'), l => l.utmSource).slice(0, 12),
      byUtmCampaign: tally(landings.filter(l => l.utmCampaign !== '(none)'), l => l.utmCampaign).slice(0, 12),
      funnel: funnelCounts(inWindow, landings),
    };
  }, [rows, days]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Compass className="h-4 w-4 text-[#2d7d7d]" />
        <h3 className="text-sm font-semibold text-gray-900">Acquisition</h3>
        {view && <span className="text-xs text-gray-400">{view.total} sessions</span>}
        <div className="ml-auto flex gap-1">
          {WINDOWS.map(w => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${days === w ? 'bg-[#2d7d7d] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !view && (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      )}

      {view && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <CountList title="Landing page" rows={view.byPageType} total={view.total} />
            <CountList title="Referrer" rows={view.byReferrer} total={view.total} />
            <CountList title="utm_source" rows={view.byUtmSource} total={view.total} />
            <CountList title="utm_campaign" rows={view.byUtmCampaign} total={view.total} />
          </div>

          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-3">Session funnel</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Step</th>
                  <th className="pb-2 font-medium text-right">Sessions</th>
                  <th className="pb-2 font-medium text-right">% of visits</th>
                </tr>
              </thead>
              <tbody>
                {view.funnel.map(({ step, sessions }) => (
                  <tr key={step} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-700">{STEP_LABELS[step as keyof typeof STEP_LABELS] ?? step}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900">{sessions}</td>
                    <td className="py-1.5 text-right text-gray-500">
                      {view.total > 0 ? `${((sessions / view.total) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Distinct tab sessions per step; steps are counted independently. Events added after a step was introduced only count from then on.
          </p>
        </>
      )}
    </div>
  );
}

function CountList({ title, rows, total }: { title: string; rows: Array<[string, number]>; total: number }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No data</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          {rows.map(([label, count]) => (
            <div key={label} className="flex justify-between gap-3">
              <span className="text-gray-600 truncate" title={label}>{label}</span>
              <span className="font-medium text-gray-900 tabular-nums">
                {count}
                <span className="text-gray-400 font-normal ml-1.5">{total > 0 ? `${Math.round((count / total) * 100)}%` : ''}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
