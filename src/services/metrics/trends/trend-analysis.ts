import type { TimeRange } from '../../../types/scholar';

export function calculateImpactTrend(
  citationsPerYear: Record<string, number>,
  timeRange: TimeRange = 'all'
): 'increasing' | 'stable' | 'decreasing' {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Filter years based on time range, excluding the current incomplete year
  const years = Object.keys(citationsPerYear)
    .map(Number)
    .filter(year => {
      if (year >= currentYear) return false; // Exclude current incomplete year
      switch (timeRange) {
        case '5y':
          return year > currentYear - 5;
        case '10y':
          return year > currentYear - 10;
        default:
          return true;
      }
    })
    .sort((a, b) => a - b);

  if (years.length < 2) {
    return 'stable';
  }

  // Calculate the trend using linear regression
  const n = years.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  years.forEach(year => {
    const citations = citationsPerYear[year] || 0;
    sumX += year;
    sumY += citations;
    sumXY += year * citations;
    sumXX += year * year;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const avgCitations = sumY / n;

  // Use relative threshold: slope as percentage of average citations
  // A 5% change relative to average is meaningful regardless of citation volume
  const threshold = Math.max(avgCitations * 0.05, 1); // At least 1 to handle very low citation counts

  if (slope > threshold) {
    return 'increasing';
  } else if (slope < -threshold) {
    return 'decreasing';
  } else {
    return 'stable';
  }
}

export function findPeakYear(
  citationsPerYear: Record<string, number>,
  timeRange: TimeRange = 'all'
): {
  year: number;
  citations: number;
} {
  const currentYear = new Date().getFullYear();

  // Filter years based on time range, excluding the current incomplete year
  const years = Object.keys(citationsPerYear)
    .map(Number)
    .filter(year => {
      if (year >= currentYear) return false; // Exclude current incomplete year
      switch (timeRange) {
        case '5y':
          return year > currentYear - 5;
        case '10y':
          return year > currentYear - 10;
        default:
          return true;
      }
    });

  if (years.length === 0) {
    return { year: 0, citations: 0 };
  }

  const peakYear = years.reduce((max, year) => 
    (citationsPerYear[year] > (citationsPerYear[max] || 0)) ? year : max, 
    years[0]
  );

  return {
    year: peakYear,
    citations: citationsPerYear[peakYear] || 0
  };
}