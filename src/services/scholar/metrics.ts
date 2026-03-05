import type { Publication, Metrics } from '../../types/scholar';

export class MetricsCalculator {
  public calculateMetrics(
    publications: Publication[],
    citationsPerYear: Record<string, number>,
    authorName: string
  ): Metrics {
    if (!publications || publications.length === 0) {
      return {
        hIndex: 0, gIndex: 0, i10Index: 0, h5Index: 0,
        totalPublications: 0, publicationsPerYear: '0',
        citationsPerYear, acc5: 0, avgCitationsPerYear: 0,
        avgCitationsPerPaper: 0, citationGrowthRate: 0,
        yearlyGrowthRates: {}, impactTrend: 'stable',
        peakCitationYear: 0, peakCitations: 0,
        collaborationScore: 0, soloAuthorScore: 0,
        averageAuthors: 0, totalCoAuthors: 0,
        topPaperCitations: 0, topPaperTitle: '', topPaperUrl: '',
        topCoAuthor: '', topCoAuthorPapers: 0,
        topCoAuthorCitations: 0, topCoAuthorFirstYear: 0,
        topCoAuthorLastYear: 0, topCoAuthorFirstPaper: '',
        topCoAuthorLastPaper: ''
      };
    }

    const citations = publications.map(p => p.citations);
    const totalCitations = citations.reduce((sum, c) => sum + c, 0);
    
    // Calculate average citations per year using complete years only
    const years = Object.keys(citationsPerYear)
      .map(Number)
      .filter(year => year < new Date().getFullYear()) // Exclude current year
      .sort();
    
    const avgCitationsPerYear = years.length > 0 
      ? Number((totalCitations / years.length).toFixed(1))
      : 0;

    const { yearlyGrowthRates, avgGrowthRate } = this.calculateGrowthRates(years, citationsPerYear);
    const peakYear = this.findPeakYear(years, citationsPerYear);
    const impactTrend = this.calculateImpactTrend(years, citationsPerYear);
    const coAuthorStats = this.calculateCoAuthorStats(publications, authorName);
    const mostCitedPaper = this.findMostCitedPaper(publications);

    return {
      hIndex: this.calculateHIndex(citations),
      gIndex: this.calculateGIndex(citations),
      i10Index: citations.filter(c => c >= 10).length,
      h5Index: this.calculateH5Index(publications),
      totalPublications: publications.length,
      publicationsPerYear: (publications.length / Math.max(1, years.length)).toFixed(1),
      citationsPerYear,
      acc5: this.calculateACC5(publications),
      avgCitationsPerYear, // Use the new consistent calculation
      avgCitationsPerPaper: Number((totalCitations / publications.length).toFixed(1)),
      citationGrowthRate: Number(avgGrowthRate.toFixed(2)),
      yearlyGrowthRates,
      impactTrend,
      peakCitationYear: peakYear,
      peakCitations: citationsPerYear[peakYear] || 0,
      ...coAuthorStats,
      topPaperCitations: mostCitedPaper.citations,
      topPaperTitle: mostCitedPaper.title,
      topPaperUrl: mostCitedPaper.url
    };
  }

  private calculateGrowthRates(years: number[], citationsPerYear: Record<string, number>) {
    const yearlyGrowthRates: Record<number, number> = {};
    let overallGrowthRate = 0;
    let validYearCount = 0;

    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Use only the last 3 complete years for growth rate calculation
    const lastThreeCompleteYears = years
      .filter(year => year < currentYear)
      .slice(-3);

    for (let i = 1; i < lastThreeCompleteYears.length; i++) {
      const prevYear = lastThreeCompleteYears[i - 1];
      const currentYear = lastThreeCompleteYears[i];
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

  private calculateImpactTrend(years: number[], citationsPerYear: Record<string, number>): 'increasing' | 'stable' | 'decreasing' {
    const currentYear = new Date().getFullYear();
    const lastThreeYears = years
      .filter(year => year < currentYear)
      .slice(-3);

    if (lastThreeYears.length < 2) return 'stable';

    const changes = [];
    for (let i = 1; i < lastThreeYears.length; i++) {
      const prevYear = lastThreeYears[i - 1];
      const currentYear = lastThreeYears[i];
      const prevCitations = citationsPerYear[prevYear] || 0;
      const currentCitations = citationsPerYear[currentYear] || 0;
      
      if (prevCitations > 0) {
        const change = ((currentCitations - prevCitations) / prevCitations) * 100;
        changes.push(change);
      }
    }

    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    return avgChange > 5 ? 'increasing' : avgChange < -5 ? 'decreasing' : 'stable';
  }

  public calculateHIndex(citations: number[]): number {
    const sortedCitations = [...citations].sort((a, b) => b - a);
    let hIndex = 0;
    for (let i = 0; i < sortedCitations.length; i++) {
      if (sortedCitations[i] >= i + 1) {
        hIndex = i + 1;
      } else {
        break;
      }
    }
    return hIndex;
  }

  public calculateGIndex(citations: number[]): number {
    const sortedCitations = [...citations].sort((a, b) => b - a);
    const cumulativeCitations = sortedCitations.reduce((acc, curr, i) => {
      acc[i] = (acc[i - 1] || 0) + curr;
      return acc;
    }, [] as number[]);
    
    let gIndex = 0;
    for (let i = 0; i < cumulativeCitations.length; i++) {
      if (cumulativeCitations[i] >= Math.pow(i + 1, 2)) {
        gIndex = i + 1;
      } else {
        break;
      }
    }
    
    return gIndex;
  }

  public calculateH5Index(publications: Publication[]): number {
    const currentYear = new Date().getFullYear();
    const recentPubs = publications.filter(pub => pub.year > currentYear - 5);
    const citations = recentPubs.map(p => p.citations).sort((a, b) => b - a);
    
    let h5Index = 0;
    for (let i = 0; i < citations.length; i++) {
      if (citations[i] >= i + 1) h5Index = i + 1;
      else break;
    }
    
    return h5Index;
  }

  private calculateACC5(publications: Publication[]): number {
    const currentYear = new Date().getFullYear();
    const recentPubs = publications.filter(pub => pub.year > currentYear - 5);
    return recentPubs.reduce((sum, pub) => sum + pub.citations, 0);
  }

  private calculateCoAuthorStats(publications: Publication[], authorName: string) {
    const coAuthorCounts = new Map<string, {
      count: number;
      citations: number;
      firstYear: number;
      lastYear: number;
      firstPaper: string;
      lastPaper: string;
    }>();
    let totalAuthors = 0;
    let soloCount = 0;

    // Helper function to normalize author names for comparison
    const normalizeAuthorName = (name: string) => {
      return name.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[.,]/g, '');
    };

    // Normalize the main author's name and create variations for matching
    const mainAuthorNormalized = normalizeAuthorName(authorName);
    const mainAuthorParts = mainAuthorNormalized.split(' ');
    const mainAuthorVariations = [
      mainAuthorNormalized,
      mainAuthorParts[mainAuthorParts.length - 1],
      mainAuthorParts[0],
      mainAuthorParts.length > 1 ? `${mainAuthorParts[0]} ${mainAuthorParts[mainAuthorParts.length - 1]}` : '',
      mainAuthorParts.length > 1 ? `${mainAuthorParts[mainAuthorParts.length - 1]}, ${mainAuthorParts[0]}` : ''
    ].filter(Boolean);

    publications.forEach(pub => {
      const normalizedAuthors = pub.authors.map(normalizeAuthorName);
      
      if (pub.authors.length === 1) {
        soloCount++;
      }
      
      totalAuthors += pub.authors.length;

      pub.authors.forEach(author => {
        const normalizedAuthor = normalizeAuthorName(author);
        const isMainAuthor = mainAuthorVariations.some(variation => 
          normalizedAuthor.includes(variation) || variation.includes(normalizedAuthor)
        );

        if (!isMainAuthor) {
          const existingData = coAuthorCounts.get(author) || {
            count: 0,
            citations: 0,
            firstYear: pub.year,
            lastYear: pub.year,
            firstPaper: pub.title,
            lastPaper: pub.title
          };

          coAuthorCounts.set(author, {
            count: existingData.count + 1,
            citations: existingData.citations + pub.citations,
            firstYear: Math.min(existingData.firstYear, pub.year),
            lastYear: Math.max(existingData.lastYear, pub.year),
            firstPaper: existingData.firstYear > pub.year ? pub.title : existingData.firstPaper,
            lastPaper: existingData.lastYear < pub.year ? pub.title : existingData.lastPaper
          });
        }
      });
    });

    // Find the top co-author
    let topCoAuthor = '';
    let topCoAuthorData = {
      count: 0,
      citations: 0,
      firstYear: 0,
      lastYear: 0,
      firstPaper: '',
      lastPaper: ''
    };

    coAuthorCounts.forEach((data, author) => {
      if (data.count > topCoAuthorData.count) {
        topCoAuthor = author;
        topCoAuthorData = data;
      }
    });

    return {
      totalCoAuthors: coAuthorCounts.size,
      averageAuthors: parseFloat((totalAuthors / publications.length).toFixed(1)),
      soloAuthorScore: Math.round((soloCount / publications.length) * 100),
      collaborationScore: Math.round(((publications.length - soloCount) / publications.length) * 100),
      topCoAuthor,
      topCoAuthorPapers: topCoAuthorData.count,
      topCoAuthorCitations: topCoAuthorData.citations,
      topCoAuthorFirstYear: topCoAuthorData.firstYear,
      topCoAuthorLastYear: topCoAuthorData.lastYear,
      topCoAuthorFirstPaper: topCoAuthorData.firstPaper,
      topCoAuthorLastPaper: topCoAuthorData.lastPaper
    };
  }

  private findPeakYear(years: number[], citationsPerYear: Record<string, number>): number {
    if (years.length === 0) return 0;
    return years.reduce((max, year) =>
      (citationsPerYear[year] > (citationsPerYear[max] || 0)) ? year : max,
      years[0]
    );
  }

  private findMostCitedPaper(publications: Publication[]): Publication {
    if (publications.length === 0) {
      return { title: '', authors: [], venue: '', year: 0, citations: 0, url: '' };
    }
    return publications.reduce((max, current) =>
      current.citations > max.citations ? current : max,
      publications[0]
    );
  }
}

export const metricsCalculator = new MetricsCalculator();