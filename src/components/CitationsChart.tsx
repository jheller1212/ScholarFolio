import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Rectangle, CartesianGrid,
  LabelList, LineChart, Line, Area, AreaChart, ComposedChart, ReferenceLine
} from 'recharts';
import { Info, TrendingUp, Calendar, Presentation as Citation, BarChart3, Activity, Layers } from 'lucide-react';
import { calculateGrowthRates } from '../services/metrics/trends/growth-metrics';
import { calculateAverageCitations } from '../services/metrics/citation/impact-metrics';
import { findPeakYear } from '../services/metrics/trends/trend-analysis';
import type { TimeRange } from '../types/scholar';
import type { Publication } from '../types/scholar';

interface CitationsChartProps {
  citationsPerYear: Record<string, number>;
  citationGraphSource?: 'cited_by_graph' | 'scraped_chart';
  publications?: Publication[];
}

type ChartMode = 'bar' | 'line';

/**
 * Smart current-year projection that blends:
 * 1. YTD pace (linear extrapolation from citations so far this year)
 * 2. Recent growth trend (weighted average of last 2-3 years' growth rates)
 *
 * Blends the two signals: early in the year trusts the growth trend more,
 * later trusts the YTD pace more (since we have more actual data).
 */
function projectCurrentYear(
  currentYearCitations: number,
  citationsPerYear: Record<string, number>
): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysPassed = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const yearProgress = daysPassed / 365;

  // 1. YTD pace: simple linear extrapolation
  const ytdProjection = yearProgress > 0.05
    ? Math.round(currentYearCitations / yearProgress)
    : 0;

  // 2. Growth-trend projection: use last 2-3 completed years
  const currentYear = now.getFullYear();
  const recentYears = [currentYear - 1, currentYear - 2, currentYear - 3]
    .filter(y => citationsPerYear[String(y)] != null);

  let trendProjection = 0;
  if (recentYears.length >= 2) {
    // Compute weighted average growth rate (more recent years weighted higher)
    const growthRates: number[] = [];
    for (let i = 0; i < recentYears.length - 1; i++) {
      const newer = citationsPerYear[String(recentYears[i])];
      const older = citationsPerYear[String(recentYears[i + 1])];
      if (older > 0) {
        growthRates.push((newer - older) / older);
      }
    }
    if (growthRates.length > 0) {
      // Weight: [2, 1] for the rates (most recent gets double weight)
      const weights = growthRates.map((_, i) => growthRates.length - i);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const weightedGrowth = growthRates.reduce((sum, rate, i) => sum + rate * weights[i], 0) / totalWeight;

      const lastFullYear = citationsPerYear[String(currentYear - 1)];
      if (lastFullYear > 0) {
        trendProjection = Math.round(lastFullYear * (1 + weightedGrowth));
      }
    }
  }

  // If we only have YTD or only have trend, use whichever is available
  if (ytdProjection <= 0 && trendProjection > 0) return trendProjection;
  if (trendProjection <= 0 && ytdProjection > 0) return ytdProjection;
  if (ytdProjection <= 0 && trendProjection <= 0) return currentYearCitations;

  // Blend: early in the year (< 25%), trust trend more.
  // Later (> 75%), trust YTD pace more. Smooth linear transition.
  const ytdWeight = Math.max(0, Math.min(1, (yearProgress - 0.1) / 0.8));
  const trendWeight = 1 - ytdWeight;

  return Math.round(ytdProjection * ytdWeight + trendProjection * trendWeight);
}

// Custom bar for actual vs predicted
const CustomBar = (props: any) => {
  const { x, y, width, height, isPredicted } = props;
  if (isPredicted) {
    return (
      <g>
        <defs>
          <pattern id="prediction-pattern" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <path d="M 0 0 L 0 4" stroke="#94a3b8" strokeWidth="2" opacity="0.5" />
          </pattern>
        </defs>
        <Rectangle x={x} y={y} width={width} height={height} fill="url(#prediction-pattern)" stroke="#94a3b8" strokeWidth={1} />
      </g>
    );
  }
  return <Rectangle x={x} y={y} width={width} height={height} fill="#2d7d7d" />;
};

const GrowthLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  const isPositive = value > 0;
  return (
    <text x={x + width / 2} y={y - 8} fill={isPositive ? '#2d7d7d' : '#64748b'} textAnchor="middle" fontSize="11" fontWeight="500">
      {isPositive ? '+' : ''}{value.toFixed(1)}%
    </text>
  );
};

const CurrentYearGrowthLabel = (props: any) => {
  const { x, y, width, value, projectedValue } = props;
  if (!value && !projectedValue) return null;
  return (
    <g>
      {value !== 0 && (
        <text x={x + width / 2} y={y - 24} fill={value > 0 ? '#2d7d7d' : '#64748b'} textAnchor="middle" fontSize="11" fontWeight="500">
          Current: {value > 0 ? '+' : ''}{value.toFixed(1)}%
        </text>
      )}
      {projectedValue !== 0 && (
        <text x={x + width / 2} y={y - 8} fill="#94a3b8" textAnchor="middle" fontSize="11" fontWeight="500">
          Projected: {projectedValue > 0 ? '+' : ''}{projectedValue.toFixed(1)}%
        </text>
      )}
    </g>
  );
};

// Shared tooltip style
const tooltipStyle = "bg-white/95 backdrop-blur-sm shadow-lg border border-gray-100 rounded-lg p-3 text-xs";

export function CitationsChart({ citationsPerYear, citationGraphSource, publications = [] }: CitationsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('5y');
  const [chartMode, setChartMode] = useState<ChartMode>('bar');

  // If no real citation graph data is available, show a message
  if (!citationsPerYear || Object.keys(citationsPerYear).length === 0) {
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

  // --- Main chart data (citations per year + current-year projection) ---
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const historicalData = Object.entries(citationsPerYear)
      .map(([year, citations]) => ({
        year: parseInt(year), citations, actualCitations: citations,
        predictedCitations: 0, projectedTotal: 0,
        yearOverYearGrowth: 0, projectedGrowth: 0
      }))
      .sort((a, b) => a.year - b.year);

    const filteredData = historicalData.filter(d => {
      switch (timeRange) {
        case '5y': return d.year > currentYear - 5;
        case '10y': return d.year > currentYear - 10;
        default: return true;
      }
    });

    // Calculate YoY growth for completed years
    for (let i = 1; i < filteredData.length; i++) {
      if (filteredData[i].year === currentYear) continue;
      const prev = filteredData[i - 1].actualCitations;
      const curr = filteredData[i].actualCitations;
      if (prev > 0) {
        filteredData[i].yearOverYearGrowth = ((curr - prev) / prev) * 100;
      }
    }

    // Smart projection for current year
    const currentYearData = filteredData.find(d => d.year === currentYear);
    if (currentYearData) {
      const projectedTotal = projectCurrentYear(currentYearData.actualCitations, citationsPerYear);
      currentYearData.projectedTotal = projectedTotal;
      currentYearData.predictedCitations = Math.max(0, projectedTotal - currentYearData.actualCitations);
      const prevYearData = filteredData.find(d => d.year === currentYear - 1);
      if (prevYearData && prevYearData.actualCitations > 0) {
        currentYearData.yearOverYearGrowth = ((currentYearData.actualCitations - prevYearData.actualCitations) / prevYearData.actualCitations) * 100;
        currentYearData.projectedGrowth = ((projectedTotal - prevYearData.actualCitations) / prevYearData.actualCitations) * 100;
      }
    }

    return filteredData;
  }, [citationsPerYear, timeRange]);

  // --- Cumulative citations over time ---
  const cumulativeData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Object.keys(citationsPerYear).map(Number).sort((a, b) => a - b);
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
        cumulative += citationsPerYear[year] || 0;
        return { year, cumulative, yearly: citationsPerYear[year] || 0 };
      });
  }, [citationsPerYear, timeRange]);

  // --- Publication output per year + running h-index ---
  const productivityData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const pubsByYear: Record<number, Publication[]> = {};
    publications.forEach(p => {
      if (p.year) {
        if (!pubsByYear[p.year]) pubsByYear[p.year] = [];
        pubsByYear[p.year].push(p);
      }
    });

    const allYears = Object.keys(citationsPerYear).map(Number)
      .concat(Object.keys(pubsByYear).map(Number));
    const uniqueYears = [...new Set(allYears)].sort((a, b) => a - b);

    const allPubsSorted: Publication[] = [];
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
        allPubsSorted.push(...yearPubs);
        const sorted = allPubsSorted.map(p => p.citations).sort((a, b) => b - a);
        let h = 0;
        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i] >= i + 1) h = i + 1;
          else break;
        }
        return { year, publications: yearPubs.length, hIndex: h, totalPubs: allPubsSorted.length };
      });
  }, [publications, citationsPerYear, timeRange]);

  // --- Citation velocity (3-year moving average) ---
  const velocityData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Object.keys(citationsPerYear).map(Number).sort((a, b) => a - b);

    return years
      .filter(y => {
        switch (timeRange) {
          case '5y': return y > currentYear - 5;
          case '10y': return y > currentYear - 10;
          default: return true;
        }
      })
      .map(year => {
        const val = citationsPerYear[year] || 0;
        const prev1 = citationsPerYear[year - 1] || 0;
        const prev2 = citationsPerYear[year - 2] || 0;
        const hasEnoughData = citationsPerYear[year - 1] !== undefined && citationsPerYear[year - 2] !== undefined;
        const movingAvg = hasEnoughData ? Math.round((val + prev1 + prev2) / 3) : val;
        const prevVal = citationsPerYear[year - 1];
        const yoyChange = prevVal != null && prevVal > 0 ? Math.round(val - prevVal) : 0;
        return { year, citations: val, movingAvg, yoyChange };
      });
  }, [citationsPerYear, timeRange]);

  // --- Summary stats ---
  const stats = useMemo(() => {
    const { avgGrowthRate } = calculateGrowthRates(citationsPerYear, timeRange);
    const { perYear: avgCitations } = calculateAverageCitations(
      chartData.map(d => ({ year: d.year, citations: d.actualCitations })), timeRange
    );
    const { year: peakYear, citations: peakCitations } = findPeakYear(citationsPerYear, timeRange);
    const totalCumulative = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].cumulative : 0;
    return { avgGrowthRate, avgCitations, peakYear, peakCitations, totalCumulative };
  }, [chartData, cumulativeData, timeRange, citationsPerYear]);

  const timeRangeText = useMemo(() => {
    const currentYear = new Date().getFullYear();
    switch (timeRange) {
      case '5y': return `${currentYear - 4}\u2013${currentYear}`;
      case '10y': return `${currentYear - 9}\u2013${currentYear}`;
      default: {
        const years = Object.keys(citationsPerYear).map(Number).sort();
        return years.length ? `${years[0]}\u2013${currentYear}` : 'All time';
      }
    }
  }, [timeRange, citationsPerYear]);

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

  const chartModeToggle = (
    <div className="flex items-center bg-gray-100 rounded-md p-0.5">
      <button
        onClick={() => setChartMode('bar')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          chartMode === 'bar' ? 'bg-white text-[#2d7d7d] font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Bar
      </button>
      <button
        onClick={() => setChartMode('line')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          chartMode === 'line' ? 'bg-white text-[#2d7d7d] font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Line
      </button>
    </div>
  );

  // Tooltip for the main chart
  const mainChartTooltip = (
    <Tooltip cursor={false} content={({ active, payload }) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      const currentYear = new Date().getFullYear();
      return (
        <div className={tooltipStyle}>
          <div className="font-medium text-gray-900 mb-1">{d.year}</div>
          <div className="space-y-1">
            <div className="text-gray-600">Citations: {d.actualCitations.toLocaleString()}</div>
            {d.year === currentYear && d.projectedTotal > d.actualCitations && (
              <div className="text-gray-500">Projected full year: ~{d.projectedTotal.toLocaleString()}</div>
            )}
            {d.yearOverYearGrowth !== 0 && (
              <div className="text-gray-600 border-t border-gray-100 pt-1 mt-1">
                YoY: {d.yearOverYearGrowth > 0 ? '+' : ''}{d.yearOverYearGrowth.toFixed(1)}%
              </div>
            )}
            {d.year === currentYear && d.projectedGrowth !== 0 && (
              <div className="text-gray-500">
                Projected YoY: {d.projectedGrowth > 0 ? '+' : ''}{d.projectedGrowth.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      );
    }} />
  );

  const renderMainChart = () => {
    const currentYear = new Date().getFullYear();

    if (chartMode === 'line') {
      // For line chart, show actual + projected as a dashed extension
      const lineData = chartData.map(d => ({
        ...d,
        projected: d.year === currentYear && d.projectedTotal > d.actualCitations ? d.projectedTotal : undefined
      }));

      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={lineData} margin={{ top: 30, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#666' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
            <YAxis orientation="right" tick={{ fontSize: 11, fill: '#666' }} tickCount={6} axisLine={false} tickLine={false} width={50} domain={[0, 'auto']} allowDecimals={false} />
            {mainChartTooltip}
            <defs>
              <linearGradient id="citationLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2d7d7d" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2d7d7d" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="actualCitations" stroke="#2d7d7d" strokeWidth={2.5} fill="url(#citationLineGradient)" dot={{ r: 3, fill: '#2d7d7d' }} activeDot={{ r: 5, fill: '#2d7d7d' }} />
            {lineData.some(d => d.projected !== undefined) && (
              <Line type="monotone" dataKey="projected" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, fill: '#94a3b8', stroke: '#94a3b8' }} connectNulls={false} />
            )}
            <LabelList dataKey="yearOverYearGrowth" content={({ x, y, width, value, index }: any) => {
              const d = chartData[index];
              if (d.year === currentYear) {
                return <CurrentYearGrowthLabel x={x - 10} y={y} width={20} value={value} projectedValue={d.projectedGrowth} />;
              }
              return <GrowthLabel x={x - 10} y={y} width={20} value={value} />;
            }} position="top" />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // Bar chart (default)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 5 }} barCategoryGap={2}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#666' }} axisLine={{ stroke: '#e5e5e5' }} tickLine={false} />
          <YAxis orientation="right" tick={{ fontSize: 11, fill: '#666' }} tickCount={6} axisLine={false} tickLine={false} width={50} domain={[0, 'auto']} allowDecimals={false} />
          {mainChartTooltip}
          <Bar dataKey="actualCitations" shape={<CustomBar />} stackId="citations">
            <LabelList dataKey="yearOverYearGrowth" content={({ x, y, width, value, index }: any) => {
              const d = chartData[index];
              const currentYear = new Date().getFullYear();
              if (d.year === currentYear) {
                return <CurrentYearGrowthLabel x={x} y={y} width={width} value={value} projectedValue={d.projectedGrowth} />;
              }
              return <GrowthLabel x={x} y={y} width={width} value={value} />;
            }} position="top" />
          </Bar>
          <Bar dataKey="predictedCitations" stackId="citations" shape={<CustomBar isPredicted={true} />} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

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
        <div className="flex items-center space-x-2">
          {chartModeToggle}
          {timeRangeButtons}
        </div>
      </div>

      {/* Row 1: Main citation chart (full width) */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-900 flex items-center mb-3">
          <BarChart3 className="h-4 w-4 text-[#2d7d7d] mr-2" />
          Annual Citations & Year-over-Year Growth
        </h4>
        <div className="h-64">
          {renderMainChart()}
        </div>
        <div className="flex items-center justify-end space-x-4 text-xs text-gray-400 mt-1">
          <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-[#2d7d7d] rounded-sm" /><span>Actual</span></div>
          <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-[#94a3b8] opacity-50 rounded-sm" /><span>Projected</span></div>
        </div>
      </div>

      {/* Row 2: Two charts side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cumulative citations area chart */}
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

        {/* Citation velocity: line + moving average */}
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
                        <div className={`${d.yoyChange > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          YoY change: {d.yoyChange > 0 ? '+' : ''}{d.yoyChange.toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                }} />
                <Bar dataKey="citations" fill="#2d7d7d" opacity={0.3} barSize={20} radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="movingAvg" stroke="#e07a5f" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#e07a5f' }} name="3-yr moving avg" />
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

      {/* Row 3: Publication output + h-index trajectory */}
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
                <Bar yAxisId="pubs" dataKey="publications" fill="#2d7d7d" opacity={0.6} barSize={16} radius={[2, 2, 0, 0]} name="Papers" />
                <Line yAxisId="hindex" type="monotone" dataKey="hIndex" stroke="#e07a5f" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#e07a5f' }} name="h-index" />
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
