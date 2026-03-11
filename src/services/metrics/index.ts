import { calculateHIndex, calculateH5Index } from './citation/h-index';
import { calculateGIndex } from './citation/g-index';
import { calculateI10Index } from './citation/i10-index';
import { calculateAverageCitations, calculateACC5 } from './citation/impact-metrics';
import { calculateCoAuthorMetrics } from './collaboration/co-author-metrics';
import { calculateGrowthRates } from './trends/growth-metrics';
import { findPeakYear, calculateImpactTrend } from './trends/trend-analysis';
import { calculateCitationHalfLife, calculateCitationGini, calculateAgeNormalizedRate } from './citation/advanced-metrics';
import type { Publication, Metrics, TimeRange } from '../../types/scholar';

class MetricsCalculator {
  public calculateMetrics(
    publications: Publication[], 
    citationsPerYear: Record<string, number>, 
    authorName: string,
    timeRange: TimeRange = 'all'
  ): Metrics {
    if (!publications || publications.length === 0) {
      return this.getEmptyMetrics();
    }

    if (!citationsPerYear || Object.keys(citationsPerYear).length === 0) {
      console.warn('[MetricsCalculator] No citationsPerYear graph data provided — metrics derived from citation graph will be empty.');
      citationsPerYear = {};
    }

    const currentYear = new Date().getFullYear();
    const citations = publications.map(p => p.citations);

    // Calculate citation metrics
    const hIndex = calculateHIndex(citations);
    const gIndex = calculateGIndex(citations);
    const i10Index = calculateI10Index(citations);
    const h5Index = calculateH5Index(publications);

    // Calculate average citations per paper from publication data
    const averages = calculateAverageCitations(
      publications.map(p => ({ year: p.year, citations: p.citations })),
      timeRange
    );

    // Calculate avg citations per year from the citation graph (not publication data)
    const graphYears = Object.keys(citationsPerYear).map(Number).filter(y => {
      if (y >= currentYear) return false;
      switch (timeRange) {
        case '5y': return y > currentYear - 5;
        case '10y': return y > currentYear - 10;
        default: return true;
      }
    });
    const graphTotal = graphYears.reduce((sum, y) => sum + (citationsPerYear[y] || 0), 0);
    const avgCitationsFromGraph = graphYears.length > 0
      ? Number((graphTotal / graphYears.length).toFixed(1))
      : averages.perYear;

    // Calculate growth and trends for the selected time range
    const { yearlyGrowthRates, avgGrowthRate } = calculateGrowthRates(citationsPerYear, timeRange);
    const peak = findPeakYear(citationsPerYear, timeRange);
    const impactTrend = calculateImpactTrend(citationsPerYear, timeRange);

    // Calculate collaboration metrics
    const coAuthorStats = calculateCoAuthorMetrics(publications, authorName);

    // Calculate advanced citation metrics
    const citationHalfLife = calculateCitationHalfLife(citationsPerYear, timeRange);
    const citationGini = calculateCitationGini(publications);
    const totalCitations = publications.reduce((sum, p) => sum + p.citations, 0);
    const ageNormalizedRate = calculateAgeNormalizedRate(totalCitations, citationsPerYear);

    // Find most cited paper within the time range
    const filteredPubs = publications.filter(pub => {
      switch (timeRange) {
        case '5y':
          return pub.year > currentYear - 5;
        case '10y':
          return pub.year > currentYear - 10;
        default:
          return true;
      }
    });
    
    const mostCitedPaper = filteredPubs.reduce((max, current) => 
      current.citations > max.citations ? current : max, 
      filteredPubs[0] || { citations: 0, title: '', url: '' }
    );

    return {
      hIndex,
      gIndex,
      i10Index,
      h5Index,
      totalPublications: publications.length,
      publicationsPerYear: (publications.length / Math.max(1, Object.keys(citationsPerYear).length)).toFixed(1),
      citationsPerYear,
      acc5: calculateACC5(publications),
      avgCitationsPerYear: avgCitationsFromGraph,
      avgCitationsPerPaper: averages.perPaper,
      citationGrowthRate: avgGrowthRate,
      yearlyGrowthRates,
      impactTrend,
      peakCitationYear: peak.year,
      peakCitations: peak.citations,
      ...coAuthorStats,
      citationHalfLife,
      citationGini,
      ageNormalizedRate,
      topPaperCitations: mostCitedPaper?.citations || 0,
      topPaperTitle: mostCitedPaper?.title || '',
      topPaperUrl: mostCitedPaper?.url || ''
    };
  }

  // Return default empty metrics object when no data is available
  private getEmptyMetrics(): Metrics {
    return {
      hIndex: 0,
      gIndex: 0,
      i10Index: 0,
      h5Index: 0,
      totalPublications: 0,
      publicationsPerYear: '0',
      citationsPerYear: {},
      acc5: 0,
      avgCitationsPerYear: 0,
      avgCitationsPerPaper: 0,
      citationGrowthRate: 0,
      yearlyGrowthRates: {},
      impactTrend: 'stable',
      peakCitationYear: 0,
      peakCitations: 0,
      collaborationScore: 0,
      soloAuthorScore: 0,
      averageAuthors: 0,
      totalCoAuthors: 0,
      topCoAuthor: '',
      topCoAuthorPapers: 0,
      topCoAuthorCitations: 0,
      topCoAuthorFirstYear: 0,
      topCoAuthorLastYear: 0,
      topCoAuthorFirstPaper: '',
      topCoAuthorLastPaper: '',
      citationHalfLife: 0,
      citationGini: 0,
      ageNormalizedRate: 0,
      topPaperCitations: 0,
      topPaperTitle: '',
      topPaperUrl: ''
    };
  }
}

export const metricsCalculator = new MetricsCalculator();