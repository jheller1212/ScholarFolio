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
  topCoAuthors: Array<{ name: string; papers: number }>;
}

export type OaStatus = 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed';

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
  /** Per-publication OA status, keyed by normalized title */
  publicationOa?: Record<string, { status: OaStatus; oaUrl?: string }>;
  /** DOI map from normalized title to DOI string (from OpenAlex) */
  doiMap?: Record<string, string>;
  /** Number of papers with a preprint (submittedVersion) available */
  preprintCount?: number;
  /** OA repository/source breakdown: display_name → count */
  repositoryCounts?: Record<string, number>;
}

export interface FieldNormalizedMetrics {
  /** Median of OpenAlex's native per-work FWCI (field/year/type-normalized; 1.0 = world average) */
  fwci: number | null;
  /** Mean of per-work FWCI — skew-prone (one viral paper dominates), shown as context only */
  fwciMean: number | null;
  /** % of classified works in the top 10% most-cited of their field (Leiden-style PP-top10%) */
  topDecileShare: number | null;
  meanCitedness: number | null;
  paperCount: number;
  rcrMean: number | null;
  rcrPaperCount: number;
}

export interface S2PublicationData {
  influentialCitationCount: number;
  tldr?: string;
  s2CitationCount?: number;
}

export interface S2Stats {
  matched: number;
  total: number;
  totalInfluentialCitations: number;
  papersWithTldr: number;
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
  openAccessFailed?: boolean;
  fieldMetrics?: FieldNormalizedMetrics;
  /** True while the OpenAlex field-normalized metrics are still being fetched. */
  fieldMetricsLoading?: boolean;
  /** Semantic Scholar per-publication data, keyed by normalized title */
  s2Data?: Record<string, S2PublicationData>;
  s2Stats?: S2Stats;
  cacheStatus?: 'hit' | 'miss';
}

export interface CoAuthorGeoData {
  name: string;
  /** Full display name from OpenAlex (for reliable Scholar search) */
  fullName?: string;
  /** OpenAlex author ID */
  openalexId?: string;
  institution: string;
  countryCode: string;
  lat: number;
  lng: number;
  sharedPapers: number;
  sharedCitations: number;
}

// Utility types
export type SortField = 'year' | 'citations' | 'title';
export type SortDirection = 'asc' | 'desc';
export type TimeRange = '5y' | '10y' | 'all';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}
