import type { Publication, TimeRange } from '../../../types/scholar';

/**
 * Citation Half-Life: How many years back (from the most recent year) you need
 * to go to account for 50% of total citations. A short half-life means impact
 * is recent; a long one means sustained/classic influence.
 */
export function calculateCitationHalfLife(
  citationsPerYear: Record<string, number>,
  timeRange: TimeRange = 'all'
): number {
  const currentYear = new Date().getFullYear();
  const years = Object.keys(citationsPerYear)
    .map(Number)
    .filter(y => {
      switch (timeRange) {
        case '5y': return y > currentYear - 5;
        case '10y': return y > currentYear - 10;
        default: return true;
      }
    })
    .sort((a, b) => b - a); // most recent first

  if (years.length === 0) return 0;

  const total = years.reduce((sum, y) => sum + (citationsPerYear[y] || 0), 0);
  if (total === 0) return 0;

  const halfTotal = total / 2;
  let cumulative = 0;

  for (const year of years) {
    cumulative += citationsPerYear[year] || 0;
    if (cumulative >= halfTotal) {
      return currentYear - year;
    }
  }

  return currentYear - years[years.length - 1];
}

/**
 * Citation Gini Coefficient: Measures how evenly citations are distributed
 * across publications. 0 = perfectly equal, 1 = all citations on one paper.
 */
export function calculateCitationGini(publications: Publication[]): number {
  if (publications.length < 2) return 0;

  const citations = publications.map(p => p.citations).sort((a, b) => a - b);
  const n = citations.length;
  const total = citations.reduce((a, b) => a + b, 0);

  if (total === 0) return 0;

  // Gini = (2 * sum(i * x_i)) / (n * sum(x_i)) - (n + 1) / n
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * citations[i];
  }

  const gini = (2 * weightedSum) / (n * total) - (n + 1) / n;
  return Number(Math.max(0, Math.min(1, gini)).toFixed(2));
}

/**
 * Age-Normalized Citation Rate: Total citations divided by career span in years.
 * More meaningful than raw citation count for comparing researchers at different
 * career stages.
 */
export function calculateAgeNormalizedRate(
  totalCitations: number,
  citationsPerYear: Record<string, number>
): number {
  const years = Object.keys(citationsPerYear).map(Number);
  if (years.length === 0) return 0;

  const firstYear = Math.min(...years);
  const currentYear = new Date().getFullYear();
  const careerYears = Math.max(1, currentYear - firstYear);

  return Number((totalCitations / careerYears).toFixed(1));
}
