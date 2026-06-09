/**
 * P-Index Calculator using OpenAlex data
 *
 * Implements the p-index from Pham, Wu & Wang (2024, JCR) using OpenAlex
 * instead of Web of Science. Computes within-journal-year percentile ranks.
 *
 * Uses OpenAlex group_by=cited_by_count to get citation distributions
 * in a single API call per journal-year (instead of paginating thousands of papers).
 *
 * Authorship weighting uses Abbas (2011, Scientometrics):
 *   w_j = 2(k - j + 1) / (k(k + 1))
 *   where k = total authors, j = author position (1-indexed)
 */

import 'dotenv/config';

const OA_API = 'https://api.openalex.org';
const EMAIL = process.env.OPENALEX_EMAIL || 'jonasheller89@gmail.com';

// --- Types ---

interface OAWork {
  id: string;
  doi?: string;
  title?: string;
  publication_year?: number;
  cited_by_count?: number;
  cited_by_percentile_year?: { min?: number; max?: number };
  authorships?: Array<{
    author_position?: string;
    author?: { id?: string; display_name?: string };
  }>;
  primary_location?: {
    source?: {
      id?: string;
      display_name?: string;
    };
  };
}

interface CitationDistribution {
  totalPapers: number;
  /** Map of citationCount -> number of papers with that count */
  freq: Map<number, number>;
  /** Highest citation count we have data for */
  maxCitationInGroups: number;
}

interface PublicationResult {
  title: string;
  year: number;
  journal: string;
  journalId: string;
  citations: number;
  percentileRank: number | null;
  globalPercentile: number | null;
  authorPosition: number;
  totalAuthors: number;
  abbasWeight: number;
  journalPapersInYear: number;
}

interface PIndexResult {
  authorName: string;
  openAlexId: string;
  totalWorks: number;
  worksWithJournalPercentile: number;
  worksWithGlobalPercentile: number;
  rawPIndex: number | null;
  owpiPIndex: number | null;
  rawPIndexGlobal: number | null;
  owpiPIndexGlobal: number | null;
  publications: PublicationResult[];
  journalYearCacheSize: number;
  apiCallsUsed: number;
}

// --- Helpers ---

let apiCalls = 0;

async function oaFetch<T>(url: string): Promise<T> {
  apiCalls++;
  const res = await fetch(url);
  if (res.status === 429) {
    console.log('  [rate limited, waiting 1s...]');
    await new Promise(r => setTimeout(r, 1000));
    apiCalls++;
    const retry = await fetch(url);
    if (!retry.ok) throw new Error(`OpenAlex ${retry.status}`);
    return retry.json() as Promise<T>;
  }
  if (!res.ok) throw new Error(`OpenAlex ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

/**
 * Abbas (2011) positional weight formula.
 * w_j = 2(k - j + 1) / (k(k + 1))
 */
function abbasWeight(position: number, totalAuthors: number): number {
  const k = totalAuthors;
  const j = position;
  if (k <= 0 || k === 1) return 1;
  return (2 * (k - j + 1)) / (k * (k + 1));
}

/**
 * Compute percentile rank from a frequency distribution.
 * Uses: (B + 0.5 * E) / N * 100
 * B = papers with fewer citations, E = papers with equal citations, N = total
 */
function percentileFromDistribution(
  citationCount: number,
  dist: CitationDistribution
): number {
  let below = 0;
  let equal = 0;

  for (const [cit, count] of dist.freq) {
    if (cit < citationCount) below += count;
    else if (cit === citationCount) equal += count;
  }

  // Papers beyond group_by cap are above our max — count them as "below" if
  // our citation count exceeds the max, otherwise they're above us
  const coveredPapers = Array.from(dist.freq.values()).reduce((a, b) => a + b, 0);
  const uncovered = dist.totalPapers - coveredPapers;
  if (uncovered > 0 && citationCount > dist.maxCitationInGroups) {
    // Our paper is in the uncovered tail — conservatively place us mid-tail
    below += coveredPapers;
    equal = Math.max(1, uncovered);
  }

  return ((below + 0.5 * equal) / dist.totalPapers) * 100;
}

// --- Core Functions ---

async function findAuthor(name: string): Promise<{ id: string; display_name: string } | null> {
  const data = await oaFetch<{ results: Array<{ id: string; display_name: string }> }>(
    `${OA_API}/authors?search=${encodeURIComponent(name)}&per_page=5&mailto=${EMAIL}`
  );
  return data.results?.[0] || null;
}

async function fetchAuthorWorks(authorId: string): Promise<OAWork[]> {
  const shortId = authorId.replace('https://openalex.org/', '');
  const allWorks: OAWork[] = [];
  let page = 1;

  while (page <= 10) {
    const data = await oaFetch<{ results: OAWork[] }>(
      `${OA_API}/works?filter=authorships.author.id:${shortId}&per_page=200&page=${page}&select=id,doi,title,publication_year,cited_by_count,cited_by_percentile_year,authorships,primary_location&mailto=${EMAIL}`
    );
    if (!data.results?.length) break;
    allWorks.push(...data.results);
    if (data.results.length < 200) break;
    page++;
  }

  return allWorks;
}

/**
 * Fetch citation distribution for a journal-year using group_by.
 * One API call per journal-year instead of paginating all papers.
 */
async function fetchJournalYearDistribution(
  sourceId: string,
  year: number,
  cache: Map<string, CitationDistribution>
): Promise<CitationDistribution | null> {
  const key = `${sourceId}__${year}`;
  if (cache.has(key)) return cache.get(key)!;

  const shortSourceId = sourceId.replace('https://openalex.org/', '');

  try {
    const data = await oaFetch<{
      meta: { count: number; groups_count: number };
      group_by: Array<{ key: string; count: number }>;
    }>(
      `${OA_API}/works?filter=primary_location.source.id:${shortSourceId},publication_year:${year}&group_by=cited_by_count&per_page=200&mailto=${EMAIL}`
    );

    if (!data.group_by?.length) return null;

    const freq = new Map<number, number>();
    let maxCit = 0;
    for (const g of data.group_by) {
      const cit = parseInt(g.key, 10);
      if (!isNaN(cit)) {
        freq.set(cit, g.count);
        if (cit > maxCit) maxCit = cit;
      }
    }

    const dist: CitationDistribution = {
      totalPapers: data.meta.count,
      freq,
      maxCitationInGroups: maxCit,
    };

    cache.set(key, dist);
    return dist;
  } catch (err) {
    console.warn(`  [warn] Failed to fetch distribution for ${shortSourceId}/${year}: ${err}`);
    return null;
  }
}

function findAuthorPositionInWork(
  work: OAWork,
  targetAuthorId: string
): { position: number; total: number } {
  const authorships = work.authorships || [];
  const total = authorships.length || 1;

  for (let i = 0; i < authorships.length; i++) {
    if (authorships[i].author?.id === targetAuthorId) {
      return { position: i + 1, total };
    }
  }

  return { position: 1, total };
}

// --- Main ---

export async function computePIndex(authorName: string): Promise<PIndexResult | null> {
  apiCalls = 0;
  console.log(`\n[P-Index] Looking up: ${authorName}`);

  const author = await findAuthor(authorName);
  if (!author) {
    console.log('[P-Index] Author not found in OpenAlex');
    return null;
  }
  console.log(`[P-Index] Found: ${author.display_name} (${author.id})`);

  const works = await fetchAuthorWorks(author.id);
  console.log(`[P-Index] Fetched ${works.length} works`);

  // Collect unique journal-year combos
  const journalYears = new Set<string>();
  for (const w of works) {
    if (w.primary_location?.source?.id && w.publication_year) {
      journalYears.add(`${w.primary_location.source.id}__${w.publication_year}`);
    }
  }
  console.log(`[P-Index] ${journalYears.size} unique journal-year combos (1 API call each)`);

  // Fetch distributions — one call per journal-year
  const cache = new Map<string, CitationDistribution>();
  let fetched = 0;
  for (const jy of journalYears) {
    const [sourceId, yearStr] = jy.split('__');
    await fetchJournalYearDistribution(sourceId, Number(yearStr), cache);
    fetched++;
    if (fetched % 10 === 0) {
      console.log(`  ... ${fetched}/${journalYears.size} distributions (${apiCalls} API calls)`);
    }
  }
  console.log(`[P-Index] Done. ${apiCalls} total API calls.`);

  // Compute percentile ranks
  const publications: PublicationResult[] = [];

  for (const work of works) {
    const sourceId = work.primary_location?.source?.id;
    const journal = work.primary_location?.source?.display_name || 'Unknown';
    const year = work.publication_year || 0;
    const citations = work.cited_by_count ?? 0;
    const { position, total } = findAuthorPositionInWork(work, author.id);
    const weight = abbasWeight(position, total);

    // Within-journal percentile
    let journalPercentile: number | null = null;
    let journalPapersInYear = 0;
    if (sourceId && year) {
      const key = `${sourceId}__${year}`;
      const dist = cache.get(key);
      if (dist) {
        journalPercentile = Number(percentileFromDistribution(citations, dist).toFixed(2));
        journalPapersInYear = dist.totalPapers;
      }
    }

    // Global percentile (for comparison)
    const globalMin = work.cited_by_percentile_year?.min;
    const globalMax = work.cited_by_percentile_year?.max;
    const globalPercentile = globalMin != null
      ? Number(((globalMin + (globalMax ?? globalMin)) / 2).toFixed(2))
      : null;

    publications.push({
      title: work.title || 'Untitled',
      year,
      journal,
      journalId: sourceId || '',
      citations,
      percentileRank: journalPercentile,
      globalPercentile,
      authorPosition: position,
      totalAuthors: total,
      abbasWeight: Number(weight.toFixed(4)),
      journalPapersInYear,
    });
  }

  // Raw p-index (within-journal)
  const withJnl = publications.filter(p => p.percentileRank !== null);
  const rawPIndex = withJnl.length > 0
    ? Number((withJnl.reduce((s, p) => s + p.percentileRank!, 0) / withJnl.length).toFixed(2))
    : null;

  // OWPI (authorship-weighted, within-journal)
  let owpiPIndex: number | null = null;
  if (withJnl.length > 0) {
    const tw = withJnl.reduce((s, p) => s + p.abbasWeight, 0);
    owpiPIndex = Number(
      (withJnl.reduce((s, p) => s + p.percentileRank! * p.abbasWeight, 0) / tw).toFixed(2)
    );
  }

  // Global versions for comparison
  const withGlb = publications.filter(p => p.globalPercentile !== null);
  const rawPIndexGlobal = withGlb.length > 0
    ? Number((withGlb.reduce((s, p) => s + p.globalPercentile!, 0) / withGlb.length).toFixed(2))
    : null;
  let owpiPIndexGlobal: number | null = null;
  if (withGlb.length > 0) {
    const tw = withGlb.reduce((s, p) => s + p.abbasWeight, 0);
    owpiPIndexGlobal = Number(
      (withGlb.reduce((s, p) => s + p.globalPercentile! * p.abbasWeight, 0) / tw).toFixed(2)
    );
  }

  publications.sort((a, b) => (b.percentileRank ?? -1) - (a.percentileRank ?? -1));

  return {
    authorName: author.display_name,
    openAlexId: author.id,
    totalWorks: works.length,
    worksWithJournalPercentile: withJnl.length,
    worksWithGlobalPercentile: withGlb.length,
    rawPIndex,
    owpiPIndex,
    rawPIndexGlobal,
    owpiPIndexGlobal,
    publications,
    journalYearCacheSize: cache.size,
    apiCallsUsed: apiCalls,
  };
}

// --- CLI Runner ---

const name = process.argv[2] || 'Jonas Heller';
computePIndex(name).then(result => {
  if (!result) {
    console.log('No results found.');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(65));
  console.log('P-INDEX RESULTS (OpenAlex data, within-journal methodology)');
  console.log('='.repeat(65));
  console.log(`Author:                      ${result.authorName}`);
  console.log(`OpenAlex ID:                 ${result.openAlexId}`);
  console.log(`Total works:                 ${result.totalWorks}`);
  console.log(`Works w/ journal percentile: ${result.worksWithJournalPercentile}`);
  console.log(`Works w/ global percentile:  ${result.worksWithGlobalPercentile}`);
  console.log(`API calls used:              ${result.apiCallsUsed}`);
  console.log('');
  console.log('  Within-Journal (true p-index methodology):');
  console.log(`    Raw P-Index (PI):           ${result.rawPIndex ?? 'N/A'}`);
  console.log(`    Authorship-Weighted (OWPI): ${result.owpiPIndex ?? 'N/A'}`);
  console.log('');
  console.log('  Cross-Field Global (for comparison):');
  console.log(`    Raw P-Index (PI):           ${result.rawPIndexGlobal ?? 'N/A'}`);
  console.log(`    Authorship-Weighted (OWPI): ${result.owpiPIndexGlobal ?? 'N/A'}`);
  console.log('');
  console.log('Top 15 publications by within-journal percentile:');
  console.log('-'.repeat(115));
  console.log(
    '  ' +
    'Jnl%'.padEnd(8) +
    'Glb%'.padEnd(8) +
    'Cit'.padEnd(7) +
    'Pos'.padEnd(5) +
    'k'.padEnd(4) +
    'w'.padEnd(8) +
    'N_jy'.padEnd(7) +
    'Journal'.padEnd(25) +
    'Title'
  );
  console.log('-'.repeat(115));

  for (const pub of result.publications.slice(0, 15)) {
    const jPct = pub.percentileRank !== null ? pub.percentileRank.toFixed(1) : '—';
    const gPct = pub.globalPercentile !== null ? pub.globalPercentile.toFixed(1) : '—';
    console.log(
      '  ' +
      jPct.padEnd(8) +
      gPct.padEnd(8) +
      String(pub.citations).padEnd(7) +
      String(pub.authorPosition).padEnd(5) +
      String(pub.totalAuthors).padEnd(4) +
      pub.abbasWeight.toFixed(3).padEnd(8) +
      String(pub.journalPapersInYear).padEnd(7) +
      pub.journal.slice(0, 23).padEnd(25) +
      pub.title.slice(0, 40)
    );
  }

  console.log('\n' + '-'.repeat(115));
  console.log('Jnl% = within-journal-year percentile | Glb% = cross-field global percentile');
  console.log('Pos = author position | k = total authors | w = Abbas weight | N_jy = journal papers in year');
});
