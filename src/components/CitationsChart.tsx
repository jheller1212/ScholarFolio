import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Rectangle, CartesianGrid,
  AreaChart, Area, ComposedChart, Line, ReferenceLine
} from 'recharts';
import { Info, TrendingUp, Calendar, Presentation as Citation, BarChart3, Activity, Layers } from 'lucide-react';
import { calculateGrowthRates } from '../services/metrics/trends/growth-metrics';
import { calculateAverageCitations } from '../services/metrics/citation/impact-metrics';
import { findPeakYear } from '../services/metrics/trends/trend-analysis';
import type { TimeRange, Publication } from '../types/scholar';

interface CitationsChartProps {
  citationsPerYear: Record<string, number>;
  citationGraphSource?: 'cited_by_graph' | 'scraped_chart';
  publications?: Publication[];
}

/** Project current year citations to full year based on how far into the year we are */
function projectCurrentYear(
  currentYearCitations: number,
  citationsPerYear: Record<string, number>
): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysPassed = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const yearProgress = daysPassed / 365;

  const ytdProjection = yearProgress > 0.05
    ? Math.round(currentYearCitations / yearProgress)
    : 0;

  const currentYear = now.getFullYear();
  const recentYears = [currentYear - 1, currentYear - 2, currentYear - 3]
    .filter(y => citationsPerYear[String(y)] != null);

  let trendProjection = 0;
  if (recentYears.length >= 2) {
    const growthRates: number[] = [];
    for (let i = 0; i < recentYears.length - 1; i++) {
      const newer = citationsPerYear[String(recentYears[i])];
      const older = citationsPerYear[String(recentYears[i + 1])];
      if (older > 0) growthRates.push((newer - older) / older);
    }
    if (growthRates.length > 0) {
      const weights = growthRates.map((_, i) => growthRates.length - i);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const weightedGrowth = growthRates.reduce((sum, rate, i) => sum + rate * weights[i], 0) / totalWeight;
      const lastFullYear = citationsPerYear[String(currentYear - 1)];
      if (lastFullYear > 0) trendProjection = Math.round(lastFullYear * (1 + weightedGrowth));
    }
  }

  if (ytdProjection <= 0 && trendProjection > 0) return trendProjection;
  if (trendProjection <= 0 && ytdProjection > 0) return ytdProjection;
  if (ytdProjection <= 0 && trendProjection <= 0) return currentYearCitations;

  const ytdWeight = Math.max(0, Math.min(1, (yearProgress - 0.1) / 0.8));
  return Math.round(ytdProjection * ytdWeight + trendProjection * (1 - ytdWeight));
}

// Solid bar for actual citations, hatched bar for projection
const ActualBar = (props: any) => {
  const { x, y, width, height } = props;
  return <Rectangle x={x} y={y} width={width} height={height} fill="#2d7d7d" radius={[2, 2, 0, 0]} />;
};

const ProjectedBar = (props: any) => {
  const { x, y, width, height } = props;
  return (
    <g>
      <defs>
        <pattern id="projected-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <path d="M 0 0 L 0 4" stroke="#2d7d7d" strokeWidth="1.5" opacity="0.35" />
        </pattern>
      </defs>
      <Rectangle x={x} y={y} width={width} height={height} fill="url(#projected-hatch)" stroke="#2d7d7d" strokeOpacity={0.3} strokeWidth={1} radius={[2, 2, 0, 0]} />
    </g>
  );
};

/** Renders YoY growth % label above each bar */
const YoYLabel = (props: any) => {
  const { x, y, width, value, index } = props;
  // value is the 'actual' dataKey value; we need yoyGrowth from the data
  const data = props.data?.[index];
  const growth = data?.yoyGrowth;
  if (growth == null) return null;
  const color = growth >= 0 ? '#059669' : '#dc2626';
  const text = `${growth >= 0 ? '+' : ''}${growth}%`;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fontWeight={500} fill={color}>
      {text}
    </text>
  );
};

const tooltipStyle = "bg-white/95 backdrop-blur-sm shadow-lg border border-gray-100 rounded-lg p-3 text-xs";

export function CitationsChart({ citationsPerYear, citationGraphSource, publications = [] }: CitationsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  // All hooks must be called unconditionally (Rules of Hooks).
  // The empty-data guard is handled in the JSX return below.
  const safeData = citationsPerYear && Object.keys(citationsPerYear).length > 0
    ? citationsPerYear : {};
  const hasData = Object.keys(safeData).length > 0;

  // --- Main bar chart data ---
  const chartData = useMemo(() => {
    if (!hasData) return [];
    const currentYear = new Date().getFullYear();
    const allData = Object.entries(safeData)
      .map(([year, citations]) => ({
        year: parseInt(year),
        actual: citations,
        projected: 0,
        projectedTotal: 0,
        isCurrentYear: parseInt(year) === currentYear,
        yoyGrowth: null as number | null,
      }))
      .sort((a, b) => a.year - b.year);

    // Calculate YoY growth %
    for (let i = 1; i < allData.length; i++) {
      const prev = allData[i - 1].actual;
      if (prev > 0 && !allData[i].isCurrentYear) {
        allData[i].yoyGrowth = Math.round(((allData[i].actual - prev) / prev) * 100);
      }
    }

    const filtered = allData.filter(d => {
      switch (timeRange) {
        case '5y': return d.year > currentYear - 5;
        case '10y': return d.year > currentYear - 10;
        default: return true;
      }
    });

    // Add projection for current year
    const cur = filtered.find(d => d.isCurrentYear);
    if (cur) {
      const total = projectCurrentYear(cur.actual, safeData);
      cur.projectedTotal = total;
      cur.projected = Math.max(0, total - cur.actual);
    }

    return filtered;
  }, [safeData, hasData, timeRange]);

  // --- Cumulative ---
  const cumulativeData = useMemo(() => {
    if (!hasData) return [];
    const currentYear = new Date().getFullYear();
    const years = Object.keys(safeData).map(Number).sort((a, b) => a - b);
    let cumulative = 0;
    return years
      .filter(y => {
        switch (timeRange) {
          case '5y': return y > currentYear - 5;
          case '10y': return y > currentYear - 10;
          default: return true;
        }
      })
      .map(year => {
        cumulative += safeData[year] || 0;
        return { year, cumulative, yearly: safeData[year] || 0 };
      });
  }, [safeData, hasData, timeRange]);

  // --- Citation velocity ---
  const velocityData = useMemo(() => {
    if (!hasData) return [];
    const currentYear = new Date().getFullYear();
    const years = Object.keys(safeData).map(Number).sort((a, b) => a - b);
    return years
      .filter(y => {
        switch (timeRange) {
          case '5y': return y > currentYear - 5;
          case '10y': return y > currentYear - 10;
          default: return true;
        }
      })
      .map(year => {
        const val = safeData[year] || 0;
        const prev1 = safeData[year - 1] || 0;
        const prev2 = safeData[year - 2] || 0;
        const hasEnough = safeData[year - 1] !== undefined && safeData[year - 2] !== undefined;
        const movingAvg = hasEnough ? Math.round((val + prev1 + prev2) / 3) : val;
        const prevVal = safeData[year - 1];
        const yoyChange = prevVal != null && prevVal > 0 ? Math.round(val - prevVal) : 0;
        return { year, citations: val, movingAvg, yoyChange };
      });
  }, [safeData, hasData, timeRange]);

  // --- Publication output + h-index ---
  const productivityData = useMemo(() => {
    if (!hasData) return [];
    const currentYear = new Date().getFullYear();
    const pubsByYear: Record<number, Publication[]> = {};
    publications.forEach(p => {
      if (p.year) {
        if (!pubsByYear[p.year]) pubsByYear[p.year] = [];
        pubsByYear[p.year].push(p);
      }
    });
    const allYears = Object.keys(safeData).map(Number).concat(Object.keys(pubsByYear).map(Number));
    const uniqueYears = [...new Set(allYears)].sort((a, b) => a - b);
    const allPubs: Publication[] = [];
    return uniqueYears
      .filter(y => {
        switch (timeRange) {
          case '5y': return y > currentYear - 5;
          case '10y': return y > currentYear - 10;
          default: return true;
        }
      })
      .map(year => {
        const yearPubs = pubsByYear[year] || [];
        allPubs.push(...yearPubs);
        const sorted = allPubs.map(p => p.citations).sort((a, b) => b - a);
        let h = 0;
        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i] >= i + 1) h = i + 1; else break;
        }
        return { year, publications: yearPubs.length, hIndex: h, totalPubs: allPubs.length };
      });
  }, [publications, safeData, hasData, timeRange]);

  // --- Summary stats ---
  const stats = useMemo(() => {
    if (!hasData) return { avgGrowthRate: 0, avgCitations: 0, peakYear: 0, peakCitations: 0, totalCumulative: 0 };
    const { avgGrowthRate } = calculateGrowthRates(safeData, timeRange);
    const { perYear: avgCitations } = calculateAverageCitations(
      chartData.map(d => ({ year: d.year, citations: d.actual })), timeRange
    );
    const { year: peakYear, citations: peakCitations } = findPeakYear(safeData, timeRange);
    const totalCumulative = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].cumulative : 0;
    return { avgGrowthRate, avgCitations, peakYear, peakCitations, totalCumulative };
  }, [chartData, cumulativeData, hasData, safeData, timeRange]);

  const timeRangeText = useMemo(() => {
    const currentYear = new Date().getFullYear();
    switch (timeRange) {
      case '5y': return `${currentYear - 4}\u2013${currentYear}`;
      case '10y': return `${currentYear - 9}\u2013${currentYear}`;
      default: {
        const years = Object.keys(safeData).map(Number).sort();
        return years.length ? `${years[0]}\u2013${currentYear}` : 'All time';
      }
    }
  }, [timeRange, safeData]);

  // --- Empty data guard (after all hooks) ---
  if (!hasData) {
    return (
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
        <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Citation graph unavailable</p>
          <p className="text-amber-600 mt-0.5">
            Google Scholar's citation-per-year data could not be retrieved. Try reloading to fetch fresh data.
          </p>
        </div>
      </div>
    );
  }

  const timeRangeButtons = (
    <div className="flex items-center space-x-1">
      {(['5y', '10y', 'all'] as TimeRange[]).map(tr => (
        <button
          key={tr}
          onClick={() => setTimeRange(tr)}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            timeRange === tr ? 'bg-[#eaf4f4] text-[#2d7d7d] font-medium' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          {tr === '5y' ? '5Y' : tr === '10y' ? '10Y' : 'All'}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary stat cards + time range */}
      <div className="flex items-start justify-between">
        <div className="grid grid-cols-4 gap-3 flex-1 mr-4">
          <div className="bg-[#eaf4f4] rounded-lg p-3">
            <div className="flex items-center text-xs text-[#2d7d7d] mb-1">
              <TrendingUp className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
              Avg Growth
            </div>
            <div className="text-lg font-semibold text-[#1e293b]">
              {stats.avgGrowthRate > 0 ? '+' : ''}{stats.avgGrowthRate}%
            </div>
            <div className="text-[10px] text-[#64748b]">per year ({timeRangeText})</div>
          </div>
          <div className="bg-[#eaf4f4] rounded-lg p-3">
            <div className="flex items-center text-xs text-[#2d7d7d] mb-1">
              <Citation className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
              Avg Citations
            </div>
            <div className="text-lg font-semibold text-[#1e293b]">
              {stats.avgCitations.toLocaleString()}
            </div>
            <div className="text-[10px] text-[#64748b]">per year ({timeRangeText})</div>
          </div>
          <div className="bg-[#eaf4f4] rounded-lg p-3">
            <div className="flex items-center text-xs text-[#2d7d7d] mb-1">
              <Calendar className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
              Peak Year
            </div>
            <div className="text-lg font-semibold text-[#1e293b]">{stats.peakYear}</div>
            <div className="text-[10px] text-[#64748b]">{stats.peakCitations.toLocaleString()} citations</div>
          </div>
          <div className="bg-[#eaf4f4] rounded-lg p-3">
            <div className="flex items-center text-xs text-[#2d7d7d] mb-1">
              <Layers className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
              Total
            </div>
            <div className="text-lg font-semibold text-[#1e293b]">{stats.totalCumulative.toLocaleString()}</div>
            <div className="text-[10px] text-[#64748b]">cumulative ({timeRangeText})</div>
          </div>
        </div>
        {timeRangeButtons}
      </div>

      {/* Citations per year bar chart — mirrors Google Scholar */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center mb-3">
          <BarChart3 className="h-4 w-4 text-[#2d7d7d] mr-2" />
          Citations per Year
        </h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#666' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
              <YAxis orientation="right" tick={{ fontSize: 11, fill: '#666' }} tickCount={6} axisLine={false} tickLine={false} width={50} domain={[0, 'auto']} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className={tooltipStyle}>
                    <div className="font-medium text-gray-900 mb-1">{d.year}</div>
                    <div className="text-gray-600">Citations: {d.actual.toLocaleString()}</div>
                    {d.yoyGrowth != null && (
                      <div className={d.yoyGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        YoY: {d.yoyGrowth >= 0 ? '+' : ''}{d.yoyGrowth}%
                      </div>
                    )}
                    {d.isCurrentYear && d.projected > 0 && (
                      <div className="text-gray-400 mt-1 pt-1 border-t border-gray-100 space-y-0.5">
                        <div>Projected full year: ~{d.projectedTotal.toLocaleString()}</div>
                        <div className="text-[10px] leading-tight">Blended estimate: YTD pace extrapolated to 365 days, weighted with a trend projection based on the prior 3 years' growth rates.</div>
                      </div>
                    )}
                  </div>
                );
              }} />
              <Bar dataKey="actual" stackId="a" shape={<ActualBar />} label={<YoYLabel data={chartData} />} />
              <Bar dataKey="projected" stackId="a" shape={<ProjectedBar />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-end space-x-4 text-xs text-gray-400 mt-1">
          <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-[#2d7d7d] rounded-sm" /><span>Citations</span></div>
          <div className="flex items-center space-x-1"><span className="text-emerald-600 font-medium">+%</span><span>/</span><span className="text-rose-600 font-medium">−%</span><span>YoY</span></div>
          {chartData.some(d => d.projected > 0) && (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-sm border border-[#2d7d7d]/30" style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(45,125,125,0.2) 2px, rgba(45,125,125,0.2) 4px)'
              }} />
              <span>Projected ({new Date().getFullYear()})</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Two charts side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cumulative citations */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-900 flex items-center mb-3">
            <Layers className="h-4 w-4 text-[#2d7d7d] mr-2" />
            Cumulative Citations
          </h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#666' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
                <YAxis orientation="right" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} width={50} allowDecimals={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className={tooltipStyle}>
                      <div className="font-medium text-gray-900 mb-1">{d.year}</div>
                      <div className="text-gray-600">Cumulative: {d.cumulative.toLocaleString()}</div>
                      <div className="text-gray-500">This year: +{d.yearly.toLocaleString()}</div>
                    </div>
                  );
                }} />
                <defs>
                  <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2d7d7d" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2d7d7d" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="cumulative" stroke="#2d7d7d" strokeWidth={2} fill="url(#cumulativeGradient)" dot={false} activeDot={{ r: 4, fill: '#2d7d7d' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Citation velocity */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-900 flex items-center mb-3">
            <Activity className="h-4 w-4 text-[#2d7d7d] mr-2" />
            Citation Velocity
          </h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={velocityData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#666' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
                <YAxis orientation="right" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} width={50} allowDecimals={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className={tooltipStyle}>
                      <div className="font-medium text-gray-900 mb-1">{d.year}</div>
                      <div className="text-gray-600">Citations: {d.citations.toLocaleString()}</div>
                      <div className="text-gray-500">3-yr avg: {d.movingAvg.toLocaleString()}</div>
                      {d.yoyChange !== 0 && (
                        <div className={d.yoyChange > 0 ? 'text-emerald-600' : 'text-rose-500'}>
                          YoY change: {d.yoyChange > 0 ? '+' : ''}{d.yoyChange.toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                }} />
                <Bar dataKey="citations" fill="#2d7d7d" opacity={0.3} barSize={20} radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="movingAvg" stroke="#e07a5f" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#e07a5f' }} />
                {stats.avgCitations > 0 && (
                  <ReferenceLine y={stats.avgCitations} stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={1} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-end space-x-4 text-xs text-gray-400 mt-1">
            <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-[#2d7d7d] opacity-30 rounded-sm" /><span>Annual</span></div>
            <div className="flex items-center space-x-1"><div className="w-6 h-0.5 bg-[#e07a5f] rounded" /><span>3-yr avg</span></div>
            <div className="flex items-center space-x-1"><div className="w-6 h-0 border-t border-dashed border-gray-400" /><span>Mean</span></div>
          </div>
        </div>
      </div>

      {/* Publication output + h-index trajectory */}
      {productivityData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-900 flex items-center mb-3">
            <TrendingUp className="h-4 w-4 text-[#2d7d7d] mr-2" />
            Publication Output & h-index Trajectory
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={productivityData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#666' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
                <YAxis yAxisId="pubs" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <YAxis yAxisId="hindex" orientation="right" tick={{ fontSize: 11, fill: '#e07a5f' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className={tooltipStyle}>
                      <div className="font-medium text-gray-900 mb-1">{d.year}</div>
                      <div className="text-gray-600">Publications: {d.publications}</div>
                      <div className="text-gray-500">Total papers: {d.totalPubs}</div>
                      <div className="text-[#e07a5f]">h-index: {d.hIndex}</div>
                    </div>
                  );
                }} />
                <Bar yAxisId="pubs" dataKey="publications" fill="#2d7d7d" opacity={0.6} barSize={16} radius={[2, 2, 0, 0]} />
                <Line yAxisId="hindex" type="monotone" dataKey="hIndex" stroke="#e07a5f" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#e07a5f' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-end space-x-4 text-xs text-gray-400 mt-1">
            <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-[#2d7d7d] opacity-60 rounded-sm" /><span>Papers/year</span></div>
            <div className="flex items-center space-x-1"><div className="w-6 h-0.5 bg-[#e07a5f] rounded" /><span>h-index</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
