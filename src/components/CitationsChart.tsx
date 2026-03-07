import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Rectangle, CartesianGrid, LabelList } from 'recharts';
import { Info, TrendingUp, Calendar, Presentation as Citation, Clock } from 'lucide-react';
import { calculateGrowthRates } from '../services/metrics/trends/growth-metrics';
import { calculateAverageCitations } from '../services/metrics/citation/impact-metrics';
import { calculateACC5 } from '../services/metrics/citation/impact-metrics';
import { findPeakYear } from '../services/metrics/trends/trend-analysis';
import type { TimeRange } from '../types/scholar';

interface CitationsChartProps {
  citationsPerYear: Record<string, number>;
}

function calculateCurrentYearProjection(currentYearCitations: number): number {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentDay = currentDate.getDate();
  
  // Calculate how much of the year has passed
  const daysInYear = 365;
  const daysPassed = Math.floor((currentMonth * 30.44) + currentDay);
  const yearProgress = daysPassed / daysInYear;
  
  // Project citations for the full year based on current rate
  if (yearProgress > 0) {
    return Math.round(currentYearCitations / yearProgress);
  }
  
  return currentYearCitations;
}

// Custom bar component for actual and predicted citations
const CustomBar = (props: any) => {
  const { x, y, width, height, isPredicted } = props;
  
  if (isPredicted) {
    return (
      <g>
        <defs>
          <pattern
            id="prediction-pattern"
            patternUnits="userSpaceOnUse"
            width="4"
            height="4"
            patternTransform="rotate(45)"
          >
            <path
              d="M 0 0 L 0 4"
              stroke="#94a3b8"
              strokeWidth="2"
              opacity="0.5"
            />
          </pattern>
        </defs>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill="url(#prediction-pattern)"
          stroke="#94a3b8"
          strokeWidth={1}
        />
      </g>
    );
  }

  return <Rectangle x={x} y={y} width={width} height={height} fill="#2d7d7d" />;
};

// Custom label component for growth rates
const GrowthLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;

  const isPositive = value > 0;
  const label = `${isPositive ? '+' : ''}${value.toFixed(1)}%`;
  
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      fill={isPositive ? '#2d7d7d' : '#64748b'}
      textAnchor="middle"
      fontSize="11"
      fontWeight="500"
    >
      {label}
    </text>
  );
};

// Custom label component for current year growth rates
const CurrentYearGrowthLabel = (props: any) => {
  const { x, y, width, value, projectedValue } = props;
  if (!value && !projectedValue) return null;

  const currentGrowth = value || 0;
  const projectedGrowth = projectedValue || 0;
  
  return (
    <g>
      {/* Current YoY growth */}
      {currentGrowth !== 0 && (
        <text
          x={x + width / 2}
          y={y - 24}
          fill={currentGrowth > 0 ? '#2d7d7d' : '#64748b'}
          textAnchor="middle"
          fontSize="11"
          fontWeight="500"
        >
          Current: {currentGrowth > 0 ? '+' : ''}{currentGrowth.toFixed(1)}%
        </text>
      )}
      
      {/* Projected YoY growth */}
      {projectedGrowth !== 0 && (
        <text
          x={x + width / 2}
          y={y - 8}
          fill="#94a3b8"
          textAnchor="middle"
          fontSize="11"
          fontWeight="500"
        >
          Projected: {projectedGrowth > 0 ? '+' : ''}{projectedGrowth.toFixed(1)}%
        </text>
      )}
    </g>
  );
};

export function CitationsChart({ citationsPerYear }: CitationsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('5y');

  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    // Convert historical data to array and sort by year
    const historicalData = Object.entries(citationsPerYear)
      .map(([year, citations]) => ({
        year: parseInt(year),
        citations,
        actualCitations: citations,
        predictedCitations: 0,
        yearOverYearGrowth: 0,
        projectedGrowth: 0
      }))
      .sort((a, b) => a.year - b.year);

    // Filter data based on selected time range
    const filteredData = historicalData.filter(d => {
      switch (timeRange) {
        case '5y':
          return d.year > currentYear - 5;
        case '10y':
          return d.year > currentYear - 10;
        default:
          return true;
      }
    });

    // Calculate year-over-year growth rates
    for (let i = 1; i < filteredData.length; i++) {
      const prevYear = filteredData[i - 1].actualCitations;
      const currentYear = filteredData[i].actualCitations;
      if (prevYear > 0) {
        const growthRate = ((currentYear - prevYear) / prevYear) * 100;
        filteredData[i].yearOverYearGrowth = growthRate;
      }
    }

    // Add projection for current year
    const currentYearData = filteredData.find(d => d.year === currentYear);
    if (currentYearData) {
      const projectedTotal = calculateCurrentYearProjection(currentYearData.actualCitations);
      currentYearData.predictedCitations = Math.max(0, projectedTotal - currentYearData.actualCitations);
      
      // Calculate projected growth rate
      const prevYearData = filteredData.find(d => d.year === currentYear - 1);
      if (prevYearData && prevYearData.actualCitations > 0) {
        const projectedGrowth = ((projectedTotal - prevYearData.actualCitations) / prevYearData.actualCitations) * 100;
        currentYearData.projectedGrowth = projectedGrowth;
      }
    }

    return filteredData;
  }, [citationsPerYear, timeRange]);

  // Calculate summary statistics based on filtered data
  const stats = useMemo(() => {
    const { avgGrowthRate } = calculateGrowthRates(citationsPerYear, timeRange);
    const { perYear: avgCitations } = calculateAverageCitations(
      chartData.map(d => ({ year: d.year, citations: d.actualCitations })), 
      timeRange
    );
    const { year: peakYear, citations: peakCitations } = findPeakYear(citationsPerYear, timeRange);

    return {
      avgGrowthRate,
      avgCitations,
      peakYear,
      peakCitations
    };
  }, [chartData, timeRange, citationsPerYear]);

  const timeRangeText = useMemo(() => {
    const currentYear = new Date().getFullYear();
    switch (timeRange) {
      case '5y':
        return `${currentYear - 4} - ${currentYear}`;
      case '10y':
        return `${currentYear - 9} - ${currentYear}`;
      default:
        const years = Object.keys(citationsPerYear).map(Number).sort();
        return years.length ? `${years[0]} - ${currentYear}` : 'All time';
    }
  }, [timeRange, citationsPerYear]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900 flex items-center">
            <Citation className="h-4 w-4 text-[#2d7d7d] mr-2" />
            Citation Trends & Projections
          </h4>
          <div className="mt-2 grid grid-cols-3 gap-4">
            <div className="bg-[#eaf4f4] rounded-lg p-3">
              <div className="flex items-center text-xs text-[#2d7d7d] mb-1">
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                Average Growth
                <div className="ml-1 text-[10px] text-[#94a3b8] flex items-center">
                  <Clock className="h-3 w-3 mr-0.5" />
                  {timeRangeText}
                </div>
              </div>
              <div className="text-lg font-semibold text-[#1e293b]">
                {stats.avgGrowthRate > 0 ? '+' : ''}{stats.avgGrowthRate}%
              </div>
              <div className="text-xs text-[#2d7d7d]">per year</div>
            </div>
            <div className="bg-[#eaf4f4] rounded-lg p-3">
              <div className="flex items-center text-xs text-[#2d7d7d] mb-1">
                <Citation className="h-3.5 w-3.5 mr-1" />
                Average Citations
                <div className="ml-1 text-[10px] text-[#94a3b8] flex items-center">
                  <Clock className="h-3 w-3 mr-0.5" />
                  {timeRangeText}
                </div>
              </div>
              <div className="text-lg font-semibold text-[#1e293b]">
                {stats.avgCitations.toLocaleString()}
              </div>
              <div className="text-xs text-[#2d7d7d]">per year</div>
            </div>
            <div className="bg-[#eaf4f4] rounded-lg p-3">
              <div className="flex items-center text-xs text-[#2d7d7d] mb-1">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Peak Year
                <div className="ml-1 text-[10px] text-[#94a3b8] flex items-center">
                  <Clock className="h-3 w-3 mr-0.5" />
                  {timeRangeText}
                </div>
              </div>
              <div className="text-lg font-semibold text-[#1e293b]">
                {stats.peakYear}
              </div>
              <div className="text-xs text-[#2d7d7d]">
                {stats.peakCitations.toLocaleString()} citations
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTimeRange('5y')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              timeRange === '5y'
                ? 'bg-[#eaf4f4] text-[#64748b]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Last 5 Years
          </button>
          <button
            onClick={() => setTimeRange('10y')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              timeRange === '10y'
                ? 'bg-[#eaf4f4] text-[#64748b]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Last 10 Years
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              timeRange === 'all'
                ? 'bg-[#eaf4f4] text-[#64748b]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Years
          </button>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData}
            margin={{ top: 30, right: 30, left: 0, bottom: 5 }}
            barCategoryGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis 
              dataKey="year"
              tick={{ fontSize: 11, fill: '#666666' }}
              axisLine={{ stroke: '#e5e5e5' }}
              tickLine={false}
            />
            <YAxis 
              orientation="right"
              tick={{ fontSize: 11, fill: '#666666' }}
              tickCount={6}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={[0, 'auto']}
              allowDecimals={false}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                const currentYear = new Date().getFullYear();
                
                return (
                  <div className="bg-white/95 backdrop-blur-sm shadow-lg border border-gray-100 rounded-lg p-3 text-xs">
                    <div className="font-medium text-gray-900 mb-1">{data.year}</div>
                    <div className="space-y-1">
                      <div className="text-gray-600">
                        Current Citations: {data.actualCitations.toLocaleString()}
                      </div>
                      {data.year === currentYear && data.predictedCitations > 0 && (
                        <>
                          <div className="text-gray-500">
                            Projected Additional: +{data.predictedCitations.toLocaleString()}
                          </div>
                          <div className="text-gray-600">
                            Total Projected: {(data.actualCitations + data.predictedCitations).toLocaleString()}
                          </div>
                          <div className="text-[#2d7d7d] text-[10px] border-t border-gray-100 pt-1 mt-1">
                            Based on current year progress
                          </div>
                        </>
                      )}
                      {data.yearOverYearGrowth !== 0 && (
                        <div className={`text-xs text-gray-600 border-t border-gray-100 pt-1 mt-1`}>
                          Year-over-Year Growth: {data.yearOverYearGrowth > 0 ? '+' : ''}{data.yearOverYearGrowth.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Bar 
              dataKey="actualCitations"
              shape={<CustomBar />}
              stackId="citations"
            >
              <LabelList
                dataKey="yearOverYearGrowth"
                content={({ x, y, width, value, index }: any) => {
                  const data = chartData[index];
                  const currentYear = new Date().getFullYear();
                  
                  if (data.year === currentYear) {
                    return (
                      <CurrentYearGrowthLabel
                        x={x}
                        y={y}
                        width={width}
                        value={value}
                        projectedValue={data.projectedGrowth}
                      />
                    );
                  }
                  
                  return (
                    <GrowthLabel
                      x={x}
                      y={y}
                      width={width}
                      value={value}
                    />
                  );
                }}
                position="top"
              />
            </Bar>
            <Bar 
              dataKey="predictedCitations"
              stackId="citations"
              shape={<CustomBar isPredicted={true} />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-end space-x-4 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-[#2d7d7d]"></div>
            <span>Actual Citations</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-[#94a3b8] bg-stripe"></div>
            <span>Projected</span>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 bg-[#eaf4f4]/50 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 text-[#2d7d7d] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-[#1e293b] mb-1">Citation Analysis</p>
              <ul className="space-y-1 text-[#64748b]">
                <li>• Average growth rate shows citation momentum over selected time range ({timeRangeText})</li>
                <li>• Peak year indicates highest citation impact period</li>
                <li>• Projections are based on current year's citation rate</li>
                <li>• Growth patterns help identify research reach over time</li>
                <li>• Consider field-specific citation patterns when interpreting</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}