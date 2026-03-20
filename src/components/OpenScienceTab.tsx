import React, { useMemo } from 'react';
import { Unlock, Lock, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Author, OaStatus } from '../types/scholar';

const OA_COLORS: Record<OaStatus, { bg: string; fill: string; text: string; label: string; tooltip: string }> = {
  gold: { bg: 'bg-amber-100', fill: 'bg-amber-400', text: 'text-amber-800', label: 'Gold', tooltip: 'Published in a fully open access journal' },
  green: { bg: 'bg-emerald-100', fill: 'bg-emerald-400', text: 'text-emerald-800', label: 'Green', tooltip: 'Available via a repository (e.g. institutional or preprint server)' },
  hybrid: { bg: 'bg-sky-100', fill: 'bg-sky-400', text: 'text-sky-800', label: 'Hybrid', tooltip: 'Open access article in a subscription journal' },
  bronze: { bg: 'bg-orange-100', fill: 'bg-orange-400', text: 'text-orange-800', label: 'Bronze', tooltip: 'Free to read on publisher site, but without an open license' },
  closed: { bg: 'bg-gray-100', fill: 'bg-gray-300', text: 'text-gray-600', label: 'Closed', tooltip: 'Not freely available' },
};

interface OpenScienceTabProps {
  data: Author;
}

function OaTrend({ publications, publicationOa }: { publications: Author['publications']; publicationOa?: Record<string, { status: OaStatus }> }) {
  const yearlyOa = useMemo(() => {
    if (!publicationOa) return [];
    const yearMap: Record<number, { total: number; oa: number }> = {};
    for (const pub of publications) {
      if (pub.year <= 0) continue;
      const normalized = pub.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const oaInfo = publicationOa[normalized];
      if (!yearMap[pub.year]) yearMap[pub.year] = { total: 0, oa: 0 };
      yearMap[pub.year].total++;
      if (oaInfo && oaInfo.status !== 'closed') yearMap[pub.year].oa++;
    }
    return Object.entries(yearMap)
      .map(([year, data]) => ({ year: parseInt(year), ...data, pct: Math.round((data.oa / data.total) * 100) }))
      .sort((a, b) => a.year - b.year)
      .filter(d => d.total >= 1);
  }, [publications, publicationOa]);

  if (yearlyOa.length < 2) return null;

  const maxTotal = Math.max(...yearlyOa.map(d => d.total));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Open Access Over Time</h3>
      <div className="space-y-1.5">
        {yearlyOa.map(({ year, total, oa, pct }) => (
          <div key={year} className="flex items-center gap-3 text-sm">
            <span className="text-gray-500 w-12 text-xs shrink-0">{year}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative" title={`${oa} of ${total} publications are open access (${pct}%)`}>
              <div
                className="absolute inset-y-0 left-0 bg-gray-300 rounded-full transition-all duration-300"
                style={{ width: `${(total / maxTotal) * 100}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#2d7d7d] rounded-full transition-all duration-300"
                style={{ width: `${(oa / maxTotal) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-16 text-right shrink-0" title={`${oa}/${total} OA`}>
              {pct}% OA
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-[#2d7d7d] inline-block" /> Open Access</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-gray-300 inline-block" /> Closed</span>
      </div>
    </div>
  );
}

export function OpenScienceTab({ data }: OpenScienceTabProps) {
  const oa = data.openAccess;

  if (!oa) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-8 text-center">
        <Unlock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading Open Access data from OpenAlex...</p>
        <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
      </div>
    );
  }

  const statuses: OaStatus[] = ['gold', 'green', 'hybrid', 'bronze', 'closed'];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
          <div className="flex items-center gap-2 text-[#2d7d7d] mb-2"><Unlock className="h-4 w-4" /></div>
          <div className="text-2xl font-bold text-gray-900">{oa.oaPercent}%</div>
          <div className="text-xs text-gray-500 mt-0.5">Open Access</div>
        </div>
        {statuses.filter(s => oa[s] > 0).map(status => (
          <div key={status} className="bg-white rounded-2xl border border-gray-100 shadow-card p-5" title={OA_COLORS[status].tooltip}>
            <div className={`flex items-center gap-2 mb-2 ${OA_COLORS[status].text}`}>
              {status === 'closed' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </div>
            <div className="text-2xl font-bold text-gray-900">{oa[status]}</div>
            <div className="text-xs text-gray-500 mt-0.5 cursor-help" title={OA_COLORS[status].tooltip}>{OA_COLORS[status].label} OA</div>
          </div>
        ))}
      </div>

      {/* Visual breakdown bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Access Breakdown</h3>
        <div className="h-8 rounded-full overflow-hidden flex">
          {statuses.filter(s => oa[s] > 0).map(status => (
            <div
              key={status}
              className={`${OA_COLORS[status].fill} transition-all duration-500 cursor-help`}
              style={{ width: `${(oa[status] / oa.total) * 100}%` }}
              title={`${OA_COLORS[status].label}: ${oa[status]} publications (${Math.round((oa[status] / oa.total) * 100)}%)`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {statuses.filter(s => oa[s] > 0).map(status => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-help" title={OA_COLORS[status].tooltip}>
              <span className={`w-3 h-3 rounded ${OA_COLORS[status].fill}`} />
              {OA_COLORS[status].label} ({oa[status]})
            </span>
          ))}
        </div>
      </div>

      {/* OA trend over time */}
      <OaTrend publications={data.publications} publicationOa={oa.publicationOa} />

      {/* ORCID */}
      {oa.orcid && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">ORCID</h3>
          <a
            href={`https://orcid.org/${oa.orcid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#2d7d7d] hover:underline"
          >
            <img src="https://info.orcid.org/wp-content/uploads/2019/11/orcid_16x16.png" alt="ORCID" className="h-4 w-4" />
            {oa.orcid}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Attribution */}
      <p className="text-[10px] text-gray-400 text-center">
        Open Access data sourced from <a href="https://openalex.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">OpenAlex</a>
      </p>
    </div>
  );
}
