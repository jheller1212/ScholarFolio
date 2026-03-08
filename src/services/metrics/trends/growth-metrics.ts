import type { TimeRange } from '../../../types/scholar';

interface GrowthMetrics {
  yearlyGrowthRates: Record<number, number>;
  avgGrowthRate: number;
}

export function calculateGrowthRates(
  citationsPerYear: Record<string, number>,
  timeRange: TimeRange = 'all'
): GrowthMetrics {
  const yearlyGrowthRates: Record<number, number> = {};
  let overallGrowthRate = 0;
  let validYearCount = 0;

  // Get current date info
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  // Google Scholar citation data lags by several months.
  // In the first half of the year (Jan-Jun), exclude the previous year too
  // since its data is likely still incomplete in Scholar's index.
  const cutoffYear = currentMonth < 6 ? currentYear - 1 : currentYear;

  // Get years and sort them
  const years = Object.keys(citationsPerYear)
    .map(Number)
    .filter(year => {
      switch (timeRange) {
        case '5y':
          return year > currentYear - 5;
        case '10y':
          return year > currentYear - 10;
        default:
          return true;
      }
    })
    .filter(year => year < cutoffYear) // Exclude incomplete years based on current date
    .sort((a, b) => a - b);

  // Use last 3 years within the selected range for growth rate
  const lastThreeYears = years.slice(-3);

  for (let i = 1; i < lastThreeYears.length; i++) {
    const prevYear = lastThreeYears[i - 1];
    const currentYear = lastThreeYears[i];
    const prevCitations = citationsPerYear[prevYear] || 0;
    const currentCitations = citationsPerYear[currentYear] || 0;
    
    if (prevCitations > 0) {
      const growthRate = ((currentCitations - prevCitations) / prevCitations) * 100;
      yearlyGrowthRates[currentYear] = Number(growthRate.toFixed(2));
      overallGrowthRate += growthRate;
      validYearCount++;
    }
  }

  return {
    yearlyGrowthRates,
    avgGrowthRate: validYearCount > 0 ? Number((overallGrowthRate / validYearCount).toFixed(2)) : 0
  };
}