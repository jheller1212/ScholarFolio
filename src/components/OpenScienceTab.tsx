import React, { useMemo } from 'react';
import { Unlock, ExternalLink } from 'lucide-react';
import { MetricsCard } from './MetricsCard';
import type { Author, OaStatus } from '../types/scholar';

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
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Open Access Over Time</h3>
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6">
        <div className="space-y-1.5">
          {yearlyOa.map(({ year, total, oa, pct }) => (
            <div key={year} className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-12 text-xs shrink-0">{year}</span>
              <div
                className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative cursor-help"
                title={`${oa} of ${total} publications are open access (${pct}%)`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-gray-200 rounded-full transition-all duration-300"
                  style={{ width: `${(total / maxTotal) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2d7d7d] to-[#3a9a9a] rounded-full transition-all duration-300"
                  style={{ width: `${(oa / maxTotal) * 100}%` }}
                />
              </div>
              <span
                className="text-xs text-gray-500 w-16 text-right shrink-0 cursor-help"
                title={`${oa} of ${total} open access`}
              >
                {pct}% OA
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded bg-gradient-to-r from-[#2d7d7d] to-[#3a9a9a] inline-block" />
            Open Access
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded bg-gray-200 inline-block" />
            Total publications
          </span>
        </div>
      </div>
    </div>
  );
}

export function OpenScienceTab({ data }: OpenScienceTabProps) {
  const oa = data.openAccess;

  if (!oa) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 text-center">
        <Unlock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading Open Access data...</p>
        <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary metrics — using MetricsCard for consistency */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Open Access Metrics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <MetricsCard title="Open Access" value={`${oa.oaPercent}%`} subtitle={`${oa.oa} of ${oa.total} publications`} icon="oaPercent" />
          {oa.gold > 0 && <MetricsCard title="Gold OA" value={oa.gold} subtitle="Fully OA journals" icon="goldOa" />}
          {oa.green > 0 && <MetricsCard title="Green OA" value={oa.green} subtitle="Repository deposits" icon="greenOa" />}
          {oa.hybrid > 0 && <MetricsCard title="Hybrid OA" value={oa.hybrid} subtitle="OA in subscription journals" icon="hybridOa" />}
          {oa.bronze > 0 && <MetricsCard title="Bronze OA" value={oa.bronze} subtitle="Free to read, no license" icon="bronzeOa" />}
          {oa.closed > 0 && <MetricsCard title="Closed Access" value={oa.closed} subtitle="Behind paywall" icon="closedAccess" />}
        </div>
      </div>

      {/* Visual breakdown bar */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Access Breakdown</h3>
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6">
          <div className="h-6 rounded-full overflow-hidden flex bg-gray-100">
            {oa.gold > 0 && (
              <div
                className="h-full bg-[#2d7d7d] transition-all duration-500 cursor-help"
                style={{ width: `${(oa.gold / oa.total) * 100}%` }}
                title={`Gold: ${oa.gold} publications (${Math.round((oa.gold / oa.total) * 100)}%) — Published in fully open access journals`}
              />
            )}
            {oa.green > 0 && (
              <div
                className="h-full bg-[#4db6ac] transition-all duration-500 cursor-help"
                style={{ width: `${(oa.green / oa.total) * 100}%` }}
                title={`Green: ${oa.green} publications (${Math.round((oa.green / oa.total) * 100)}%) — Available via repositories`}
              />
            )}
            {oa.hybrid > 0 && (
              <div
                className="h-full bg-[#80cbc4] transition-all duration-500 cursor-help"
                style={{ width: `${(oa.hybrid / oa.total) * 100}%` }}
                title={`Hybrid: ${oa.hybrid} publications (${Math.round((oa.hybrid / oa.total) * 100)}%) — OA in subscription journals`}
              />
            )}
            {oa.bronze > 0 && (
              <div
                className="h-full bg-[#b2dfdb] transition-all duration-500 cursor-help"
                style={{ width: `${(oa.bronze / oa.total) * 100}%` }}
                title={`Bronze: ${oa.bronze} publications (${Math.round((oa.bronze / oa.total) * 100)}%) — Free to read, no open license`}
              />
            )}
            {oa.closed > 0 && (
              <div
                className="h-full bg-gray-300 transition-all duration-500 cursor-help"
                style={{ width: `${(oa.closed / oa.total) * 100}%` }}
                title={`Closed: ${oa.closed} publications (${Math.round((oa.closed / oa.total) * 100)}%) — Behind paywall`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {oa.gold > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-gray-600 cursor-help" title="Published in fully open access journals">
                <span className="w-3 h-3 rounded bg-[#2d7d7d]" /> Gold ({oa.gold})
              </span>
            )}
            {oa.green > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-gray-600 cursor-help" title="Available via repositories">
                <span className="w-3 h-3 rounded bg-[#4db6ac]" /> Green ({oa.green})
              </span>
            )}
            {oa.hybrid > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-gray-600 cursor-help" title="OA in subscription journals">
                <span className="w-3 h-3 rounded bg-[#80cbc4]" /> Hybrid ({oa.hybrid})
              </span>
            )}
            {oa.bronze > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-gray-600 cursor-help" title="Free to read, no open license">
                <span className="w-3 h-3 rounded bg-[#b2dfdb]" /> Bronze ({oa.bronze})
              </span>
            )}
            {oa.closed > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-gray-600 cursor-help" title="Behind paywall">
                <span className="w-3 h-3 rounded bg-gray-300" /> Closed ({oa.closed})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* OA trend over time */}
      <OaTrend publications={data.publications} publicationOa={oa.publicationOa} />

      {/* ORCID */}
      {oa.orcid && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">ORCID</h3>
          <div className="bg-white rounded-xl border border-gray-100 shadow-card p-4">
            <a
              href={`https://orcid.org/${oa.orcid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#2d7d7d] hover:text-[#1a5c5c] transition-colors"
            >
              <img src="https://info.orcid.org/wp-content/uploads/2019/11/orcid_16x16.png" alt="ORCID" className="h-4 w-4" />
              {oa.orcid}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* Attribution */}
      <p className="text-[10px] text-gray-400 text-center">
        Data sourced from{' '}
        <a href="https://openalex.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">
          OpenAlex
        </a>
      </p>
    </div>
  );
}
