/**
 * Web of Science P-Index Calculator
 *
 * Computes the actual p-index using WoS API data:
 * - Fetches researcher's publications from WoS
 * - For each publication, gets the citation distribution of that journal+year
 * - Computes the percentile rank of each paper within its journal+year
 * - Averages to get the raw p-index and authorship-weighted p-index (OWPI)
 *
 * Requires: WOS_API_KEY in .env (Institutional Member plan with citation data)
 */

import 'dotenv/config';

const WOS_STARTER_API = 'https://api.clarivate.com/apis/wos-starter/v1';
const WOS_JOURNALS_API = 'https://api.clarivate.com/apis/wos-journals/v1';
const API_KEY = process.env.WOS_API_KEY;

interface WosDocument {
  uid: string;
  title: string;
  sourceTitle: string;  // journal name
  publishYear: number;
  citationCount: number;
  doi?: string;
  authors: string[];
}

interface JournalYearDistribution {
  journal: string;
  year: number;
  totalArticles: number;
  citationCounts: number[];  // sorted citation counts for all articles
}

interface WosPIndexResult {
  authorName: string;
  totalPublications: number;
  publicationsWithRank: number;
  rawPIndex: number;
  authorshipWeightedPIndex: number;
  medianPercentile: number;
  totalWosCitations: number;
  apiCallsUsed: number;
  publications: Array<{
    title: string;
    journal: string;
    year: number;
    citations: number;
    percentileRank: number;
    journalArticleCount: number;
    authorPosition: 'first' | 'last' | 'middle' | 'sole';
  }>;
}

let apiCallCount = 0;

async function wosStarterFetch<T>(endpoint: string): Promise<T> {
  if (!API_KEY) throw new Error('WOS_API_KEY not set in .env');
  apiCallCount++;

  const res = await fetch(`${WOS_STARTER_API}${endpoint}`, {
    headers: {
      'X-ApiKey': API_KEY,
      'Accept': 'application/json',
    },
  });

  if (res.status === 429) {
    console.log('[WoS] Rate limited. Waiting 2s...');
    await new Promise(r => setTimeout(r, 2000));
    apiCallCount++;
    const retry = await fetch(`${WOS_STARTER_API}${endpoint}`, {
      headers: { 'X-ApiKey': API_KEY, 'Accept': 'application/json' },
    });
    if (!retry.ok) throw new Error(`WoS API ${retry.status}: ${retry.statusText}`);
    return retry.json() as Promise<T>;
  }

  if (!res.ok) throw new Error(`WoS API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function wosJournalsFetch<T>(endpoint: string): Promise<T> {
  if (!API_KEY) throw new Error('WOS_API_KEY not set in .env');
  apiCallCount++;

  const res = await fetch(`${WOS_JOURNALS_API}${endpoint}`, {
    headers: {
      'X-ApiKey': API_KEY,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`WoS Journals API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

/**
 * Search WoS for an author's publications
 */
async function searchAuthorPublications(
  firstName: string,
  lastName: string,
  org?: string
): Promise<WosDocument[]> {
  let query = `AU=(${lastName}, ${firstName})`;
  if (org) query += ` AND OG=(${org})`;

  console.log(`[WoS] Searching: ${query}`);

  // Note: WoS Starter API response format may vary — adjust parsing as needed
  // once we can test with real responses
  const data = await wosStarterFetch<any>(
    `/documents?db=WOS&q=${encodeURIComponent(query)}&limit=50&page=1`
  );

  const documents: WosDocument[] = [];
  const hits = data?.hits || data?.Data?.Records?.records?.REC || [];

  for (const hit of hits) {
    documents.push({
      uid: hit.uid || hit.UID || '',
      title: hit.title || hit.Title?.['0'] || '',
      sourceTitle: hit.sourceTitle || hit.Source || '',
      publishYear: Number(hit.publishYear || hit.Published?.Year || 0),
      citationCount: Number(hit.citationCount || hit.TimesCited || 0),
      doi: hit.doi || hit.DOI || undefined,
      authors: Array.isArray(hit.authors) ? hit.authors : [],
    });
  }

  console.log(`[WoS] Found ${documents.length} publications (used ${apiCallCount} API calls)`);
  return documents;
}

/**
 * For a given journal + year, compute where a paper's citation count
 * falls in the percentile distribution.
 *
 * This is the core of the p-index: what percentile is this paper at
 * compared to all other papers in the same journal in the same year?
 */
function computePercentileRank(citationCount: number, distribution: number[]): number {
  if (distribution.length === 0) return 50;

  const sorted = [...distribution].sort((a, b) => a - b);
  const belowCount = sorted.filter(c => c < citationCount).length;
  const equalCount = sorted.filter(c => c === citationCount).length;

  // Percentile rank formula: (B + 0.5 * E) / N * 100
  const percentile = ((belowCount + 0.5 * equalCount) / sorted.length) * 100;
  return Number(percentile.toFixed(2));
}

function determineAuthorPosition(
  authors: string[],
  firstName: string,
  lastName: string
): 'first' | 'last' | 'middle' | 'sole' {
  if (authors.length <= 1) return 'sole';

  const nameLower = lastName.toLowerCase();
  const firstAuthor = authors[0]?.toLowerCase() || '';
  const lastAuthor = authors[authors.length - 1]?.toLowerCase() || '';

  if (firstAuthor.includes(nameLower)) return 'first';
  if (lastAuthor.includes(nameLower)) return 'last';
  return 'middle';
}

function authorPositionWeight(position: string): number {
  switch (position) {
    case 'sole': return 2.0;
    case 'first': return 1.5;
    case 'last': return 1.3;
    case 'middle': return 0.7;
    default: return 1.0;
  }
}

export async function computeWosPIndex(
  firstName: string,
  lastName: string,
  org?: string
): Promise<WosPIndexResult | null> {
  console.log(`\n[WoS] Computing p-index for: ${firstName} ${lastName}`);
  apiCallCount = 0;

  const documents = await searchAuthorPublications(firstName, lastName, org);
  if (documents.length === 0) {
    console.log('[WoS] No publications found');
    return null;
  }

  // TODO: For each unique journal+year combo, fetch the citation distribution
  // from the WoS Journals API. This requires testing with real API responses
  // to understand the exact response format.
  //
  // For now, we compute percentile ranks using the author's own publication
  // set grouped by journal+year as a placeholder. Once the API key is
  // approved, we'll replace this with actual journal-wide distributions.

  // Group by journal+year
  const journalYearGroups = new Map<string, WosDocument[]>();
  for (const doc of documents) {
    const key = `${doc.sourceTitle}___${doc.publishYear}`;
    if (!journalYearGroups.has(key)) journalYearGroups.set(key, []);
    journalYearGroups.get(key)!.push(doc);
  }

  console.log(`[WoS] ${journalYearGroups.size} unique journal-year combinations`);
  console.log(`[WoS] NOTE: Using placeholder percentiles until journal distributions are available`);

  const publications: WosPIndexResult['publications'] = [];
  const percentiles: number[] = [];
  const weightedPercentiles: { value: number; weight: number }[] = [];

  for (const doc of documents) {
    const position = determineAuthorPosition(doc.authors, firstName, lastName);

    // Placeholder: use 50th percentile until we have real journal data
    // This will be replaced with computePercentileRank(doc.citationCount, journalDistribution)
    const percentileRank = 50;

    percentiles.push(percentileRank);
    weightedPercentiles.push({
      value: percentileRank,
      weight: authorPositionWeight(position),
    });

    publications.push({
      title: doc.title,
      journal: doc.sourceTitle,
      year: doc.publishYear,
      citations: doc.citationCount,
      percentileRank,
      journalArticleCount: 0, // Will be populated with real data
      authorPosition: position,
    });
  }

  const rawPIndex = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
  const totalWeight = weightedPercentiles.reduce((sum, wp) => sum + wp.weight, 0);
  const owpi = weightedPercentiles.reduce((sum, wp) => sum + wp.value * wp.weight, 0) / totalWeight;

  const sorted = [...percentiles].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  publications.sort((a, b) => b.percentileRank - a.percentileRank);

  return {
    authorName: `${firstName} ${lastName}`,
    totalPublications: documents.length,
    publicationsWithRank: percentiles.length,
    rawPIndex: Number(rawPIndex.toFixed(2)),
    authorshipWeightedPIndex: Number(owpi.toFixed(2)),
    medianPercentile: Number(median.toFixed(2)),
    totalWosCitations: documents.reduce((sum, d) => sum + d.citationCount, 0),
    apiCallsUsed: apiCallCount,
    publications,
  };
}

// CLI runner
if (!API_KEY) {
  console.log('WOS_API_KEY not set. Copy .env.example to .env and add your key.');
  console.log('API approval pending — run test:openalex in the meantime.');
  process.exit(0);
}

const args = process.argv.slice(2);
const firstName = args[0] || 'Jonas';
const lastName = args[1] || 'Heller';
const org = args[2] || undefined;

computeWosPIndex(firstName, lastName, org).then(result => {
  if (!result) {
    console.log('No results found.');
    process.exit(1);
  }

  console.log('\n=== WoS P-Index Results ===');
  console.log(`Author:                    ${result.authorName}`);
  console.log(`Publications (total):      ${result.totalPublications}`);
  console.log(`Raw P-Index:               ${result.rawPIndex}`);
  console.log(`Authorship-Weighted PI:    ${result.authorshipWeightedPIndex}`);
  console.log(`Median Percentile:         ${result.medianPercentile}`);
  console.log(`Total WoS Citations:       ${result.totalWosCitations}`);
  console.log(`API Calls Used:            ${result.apiCallsUsed}`);
  console.log(`\nTop 10 publications by percentile:`);

  for (const pub of result.publications.slice(0, 10)) {
    console.log(`  [${pub.percentileRank}%] ${pub.citations} cit | ${pub.authorPosition} | ${pub.title.slice(0, 60)}`);
  }
});
