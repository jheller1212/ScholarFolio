// Basic types without journal rankings
export interface Topic {
  name: string;
  url: string;
  paperCount: number;
}

export interface JournalRanking {
  sjr?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  jcr?: string; // Impact factor as string (e.g., "5.342")
  ft50?: boolean;
  abs?: '4*' | '4' | '3' | '2' | '1';
  abdc?: 'A*' | 'A' | 'B' | 'C';
}

export interface Publication {
  title: string;
  authors: string[];
  venue: string;
  year: number;
  citations: number;
  url: string;
  journalRanking?: JournalRanking;
}

export interface Metrics {
  hIndex: number;
  gIndex: number;
  i10Index: number;
  h5Index: number;
  totalPublications: number;
  publicationsPerYear: string;
  citationsPerYear: Record<string, number>;
  citationGraphSource?: 'cited_by_graph' | 'scraped_chart';
  acc5: number;
  avgCitationsPerYear: number;
  avgCitationsPerPaper: number;
  citationGrowthRate: number;
  yearlyGrowthRates: Record<number, number>;
  impactTrend: 'increasing' | 'stable' | 'decreasing';
  peakCitationYear: number;
  peakCitations: number;
  collaborationScore: number;
  soloAuthorScore: number;
  averageAuthors: number;
  totalCoAuthors: number;
  citationHalfLife: number;
  citationGini: number;
  ageNormalizedRate: number;
  topPaperCitations: number;
  topPaperTitle: string;
  topPaperUrl: string;
  topCoAuthor: string;
  topCoAuthorPapers: number;
  topCoAuthorCitations: number;
  topCoAuthorFirstYear: number;
  topCoAuthorLastYear: number;
  topCoAuthorFirstPaper: string;
  topCoAuthorLastPaper: string;
}

export interface OpenAccessStats {
  total: number;
  oa: number;
  gold: number;
  green: number;
  hybrid: number;
  bronze: number;
  closed: number;
  oaPercent: number;
  orcid?: string;
}

export interface Author {
  name: string;
  affiliation: string;
  imageUrl?: string;
  topics: Topic[];
  hIndex: number;
  totalCitations: number;
  publications: Publication[];
  metrics: Metrics;
  openAccess?: OpenAccessStats;
}

// Utility types
export type SortField = 'year' | 'citations' | 'title';
export type SortDirection = 'asc' | 'desc';
export type TimeRange = '5y' | '10y' | 'all';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}