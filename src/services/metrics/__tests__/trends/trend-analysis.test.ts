import { calculateImpactTrend, findPeakYear } from '../../trends/trend-analysis';

describe('trend analysis calculations', () => {
  const currentYear = new Date().getFullYear();

  describe('calculateImpactTrend', () => {
    test('should detect increasing trend', () => {
      const citationsPerYear: Record<string, number> = {
        [currentYear - 5]: 50,
        [currentYear - 4]: 80,
        [currentYear - 3]: 120,
        [currentYear - 2]: 170,
        [currentYear - 1]: 230,
      };
      expect(calculateImpactTrend(citationsPerYear)).toBe('increasing');
    });

    test('should detect decreasing trend', () => {
      const citationsPerYear: Record<string, number> = {
        [currentYear - 5]: 230,
        [currentYear - 4]: 180,
        [currentYear - 3]: 130,
        [currentYear - 2]: 90,
        [currentYear - 1]: 50,
      };
      expect(calculateImpactTrend(citationsPerYear)).toBe('decreasing');
    });

    test('should detect stable trend', () => {
      const citationsPerYear: Record<string, number> = {
        [currentYear - 5]: 100,
        [currentYear - 4]: 102,
        [currentYear - 3]: 99,
        [currentYear - 2]: 101,
        [currentYear - 1]: 100,
      };
      expect(calculateImpactTrend(citationsPerYear)).toBe('stable');
    });

    test('should exclude current incomplete year from trend calculation', () => {
      // Without exclusion, the low current-year value would skew the trend to "decreasing"
      const citationsPerYear: Record<string, number> = {
        [currentYear - 3]: 100,
        [currentYear - 2]: 150,
        [currentYear - 1]: 200,
        [currentYear]: 30, // Incomplete year - should be ignored
      };
      expect(calculateImpactTrend(citationsPerYear)).toBe('increasing');
    });

    test('should use relative threshold for high-citation researchers', () => {
      // For a researcher with ~10,000 citations/year, a slope of 5 is noise
      const citationsPerYear: Record<string, number> = {
        [currentYear - 5]: 10000,
        [currentYear - 4]: 10002,
        [currentYear - 3]: 10005,
        [currentYear - 2]: 10003,
        [currentYear - 1]: 10008,
      };
      // Slope is ~2 per year, which is negligible at 10,000 citations
      expect(calculateImpactTrend(citationsPerYear)).toBe('stable');
    });

    test('should return stable for insufficient data', () => {
      const citationsPerYear: Record<string, number> = {
        [currentYear - 1]: 100,
      };
      expect(calculateImpactTrend(citationsPerYear)).toBe('stable');
    });
  });

  describe('findPeakYear', () => {
    test('should find the peak year correctly', () => {
      const citationsPerYear: Record<string, number> = {
        [currentYear - 3]: 100,
        [currentYear - 2]: 200,
        [currentYear - 1]: 150,
      };
      const result = findPeakYear(citationsPerYear);
      expect(result.year).toBe(currentYear - 2);
      expect(result.citations).toBe(200);
    });

    test('should exclude current incomplete year from peak calculation', () => {
      const citationsPerYear: Record<string, number> = {
        [currentYear - 2]: 100,
        [currentYear - 1]: 200,
        [currentYear]: 50, // Incomplete year - should be ignored even though it's not the peak
      };
      const result = findPeakYear(citationsPerYear);
      expect(result.year).toBe(currentYear - 1);
      expect(result.citations).toBe(200);
    });

    test('should respect time range filter', () => {
      const citationsPerYear: Record<string, number> = {
        [currentYear - 8]: 500, // Outside 5y range
        [currentYear - 3]: 100,
        [currentYear - 2]: 200,
        [currentYear - 1]: 150,
      };
      const result = findPeakYear(citationsPerYear, '5y');
      expect(result.year).toBe(currentYear - 2);
      expect(result.citations).toBe(200);
    });

    test('should return zero for empty data', () => {
      const result = findPeakYear({});
      expect(result.year).toBe(0);
      expect(result.citations).toBe(0);
    });
  });
});
