/**
 * Scraper Validation Script
 *
 * Compares cached SerpAPI results from Supabase against fresh
 * Google Scholar scrapes to evaluate scraper reliability.
 *
 * Run: SUPABASE_ANON_KEY=<key> npx tsx scripts/validate-scraper.ts
 */

// --- Config ---
const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const TEST_PROFILES = [
  // Small (< 20 pubs)
  { user: 'r8BkP18AAAAJ', label: 'Silvia Stroe (11 pubs)' },
  { user: 'zaN7A_8AAAAJ', label: 'Jorg Pareigis (19 pubs)' },
  // Medium (20-60 pubs)
  { user: 'X1AcSacAAAAJ', label: 'Enric Junque de Fortuny (24 pubs)' },
  { user: 'itvAY24AAAAJ', label: 'Susan Stead (26 pubs)' },
  { user: 'oi30zzUAAAAJ', label: 'Sandra J. Geiger (39 pubs)' },
  { user: 'VeefxSIAAAAJ', label: 'Mirko Heinzel (42 pubs)' },
  // Large (60-100 pubs)
  { user: 'LIMPvtkAAAAJ', label: 'Mathew Chylinski (66 pubs)' },
  { user: '8fB2RqoAAAAJ', label: 'Patrick Zschech (87 pubs)' },
  // Very large (100+ pubs — Scholar default page is 100)
  { user: 'yiqi1pEAAAAJ', label: 'Marnik Dekimpe (296 pubs)' },
  { user: 'x3L7H_wAAAAJ', label: 'Martin Wetzels (320 pubs)' },
  { user: 'nWTsugIAAAAJ', label: 'John Antonakis (487 pubs)' },
  { user: 'THsg1_IAAAAJ', label: 'Ko de Ruyter (1000 pubs)' },
];

const SCRAPER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache',
};

// --- Types ---
interface ProfileData {
  name: string;
  affiliation: string;
  imageUrl: string;
  topics: string[];
  publicationCount: number;
  topPapers: Array<{ title: string; citations: number; year: number }>;
  totalCitations: number;
  hIndex: number;
  i10Index: number;
  citationsPerYear: Record<string, number>;
  hasCitationGraph: boolean;
}

interface ComparisonResult {
  label: string;
  userId: string;
  serpapi: ProfileData | null;
  scraper: ProfileData | null;
  scraperError: string | null;
  matches: {
    name: boolean;
    affiliation: boolean;
    hasImage: boolean;
    topicsOverlap: number;
    topicsTotal: number;
    pubCountSerpapi: number;
    pubCountScraper: number;
    pubCountDiff: number;
    pubCountPercent: number;
    citationsDiff: number;
    citationsPercent: number;
    topPaperTitleMatches: number;
    hasCitationGraph: boolean;
    hIndexMatch: boolean;
    i10IndexMatch: boolean;
  } | null;
}

// --- Fetch cached SerpAPI data from Supabase ---
async function fetchCachedData(userId: string): Promise<ProfileData | null> {
  const url = `https://scholar.google.com/citations?user=${userId}`;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/scholar_cache?url=eq.${encodeURIComponent(url)}&select=data`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) return null;
  const rows = await response.json();
  if (!rows.length) return null;

  const data = rows[0].data;
  const pubs = data.publications || [];

  return {
    name: data.name || '',
    affiliation: data.affiliation || '',
    imageUrl: data.imageUrl || '',
    topics: (data.topics || []).map((t: { name: string }) => t.name),
    publicationCount: pubs.length,
    topPapers: pubs
      .sort((a: { citations: number }, b: { citations: number }) => b.citations - a.citations)
      .slice(0, 5)
      .map((p: { title: string; citations: number; year: number }) => ({
        title: p.title,
        citations: p.citations,
        year: p.year,
      })),
    totalCitations: pubs.reduce((s: number, p: { citations: number }) => s + p.citations, 0),
    hIndex: data.metrics?.hIndex ?? -1,
    i10Index: data.metrics?.i10Index ?? -1,
    citationsPerYear: data.metrics?.citationsPerYear || {},
    hasCitationGraph: Object.keys(data.metrics?.citationsPerYear || {}).length > 0,
  };
}

// --- Scrape Google Scholar directly (multi-page) ---
async function scrapeProfile(userId: string): Promise<ProfileData> {
  // First page — profile info + first 100 pubs
  const firstPageUrl = `https://scholar.google.com/citations?user=${userId}&hl=en&cstart=0&pagesize=100`;

  const response = await fetch(firstPageUrl, {
    headers: SCRAPER_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  if (html.includes('unusual traffic') || html.includes('please show you') || html.includes('automated access')) {
    throw new Error('CAPTCHA / rate limited');
  }

  if (!html.includes('gsc_prf_in')) {
    throw new Error('Profile not found or private');
  }

  // Parse profile info
  const name = html.match(/id="gsc_prf_in"[^>]*>([^<]+)/)?.[1]?.trim() || '';
  const affiliation = html.match(/class="gsc_prf_il"[^>]*>([^<]+)/)?.[1]?.trim() || '';
  const imageUrl = html.match(/id="gsc_prf_pup-img"[^>]*src="([^"]+)"/)?.[1] || '';

  // Topics
  const topicMatches = [...html.matchAll(/id="gsc_prf_int"[\s\S]*?<\/div>/g)];
  const topicSection = topicMatches[0]?.[0] || '';
  const topics = [...topicSection.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim());

  // h-index and i10-index from the stats table
  const hIndexMatch = html.match(/gsc_rsb_st[\s\S]*?<td class="gsc_rsb_std">(\d+)<\/td>\s*<td class="gsc_rsb_std">(\d+)<\/td>\s*<\/tr>\s*<tr[\s\S]*?<td class="gsc_rsb_std">(\d+)<\/td>\s*<td class="gsc_rsb_std">(\d+)<\/td>/);
  const hIndex = hIndexMatch ? parseInt(hIndexMatch[1]) : -1;
  const i10Index = hIndexMatch ? parseInt(hIndexMatch[3]) : -1;

  // Parse publications from first page
  const publications = parsePubs(html);

  // Check if there are more pages (look for "Show more" button)
  const hasMore = html.includes('gsc_bpf_more') && !html.includes('disabled="disabled" id="gsc_bpf_more"');

  // Fetch additional pages if needed (up to 5 pages = 500 pubs)
  if (hasMore && publications.length >= 80) {
    for (let start = 100; start <= 900; start += 100) {
      const delay = 2000 + Math.random() * 2000;
      await new Promise((r) => setTimeout(r, delay));

      try {
        const pageUrl = `https://scholar.google.com/citations?user=${userId}&hl=en&cstart=${start}&pagesize=100`;
        const pageResp = await fetch(pageUrl, {
          headers: SCRAPER_HEADERS,
          signal: AbortSignal.timeout(15000),
        });

        if (!pageResp.ok) break;
        const pageHtml = await pageResp.text();

        if (pageHtml.includes('unusual traffic') || pageHtml.includes('automated access')) {
          console.log(`    [page ${start / 100 + 1}] CAPTCHA hit, stopping pagination`);
          break;
        }

        const pagePubs = parsePubs(pageHtml);
        if (pagePubs.length === 0) break;
        publications.push(...pagePubs);
        console.log(`    [page ${start / 100 + 1}] +${pagePubs.length} pubs (total: ${publications.length})`);

        if (pagePubs.length < 80) break; // last page
      } catch {
        break;
      }
    }
  }

  // Citations per year chart
  const citationsPerYear: Record<string, number> = {};
  const yearLabels = [...html.matchAll(/class="gsc_g_t"[^>]*>(\d{4})<\/span>/g)].map((m) => m[1]);
  const barValues = [...html.matchAll(/class="gsc_g_al"[^>]*>(\d+)<\/span>/g)].map((m) => parseInt(m[1]));
  if (yearLabels.length === barValues.length) {
    yearLabels.forEach((y, i) => {
      citationsPerYear[y] = barValues[i];
    });
  }

  const totalCitations = publications.reduce((s, p) => s + p.citations, 0);

  return {
    name,
    affiliation,
    imageUrl,
    topics,
    publicationCount: publications.length,
    topPapers: publications
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 5),
    totalCitations,
    hIndex,
    i10Index,
    citationsPerYear,
    hasCitationGraph: Object.keys(citationsPerYear).length > 0,
  };
}

function parsePubs(html: string): Array<{ title: string; citations: number; year: number }> {
  const publications: Array<{ title: string; citations: number; year: number }> = [];
  const pubMatches = [...html.matchAll(/class="gsc_a_tr"[\s\S]*?<\/tr>/g)];

  for (const match of pubMatches) {
    const row = match[0];
    const title = row.match(/class="gsc_a_at"[^>]*>([^<]+)/)?.[1]?.trim() || '';
    const yearMatch = row.match(/class="gsc_a_y"[^>]*><span[^>]*>(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : 0;
    const citMatch = row.match(/class="gsc_a_c"[^>]*><a[^>]*>(\d+)/);
    const citations = citMatch ? parseInt(citMatch[1]) : 0;

    if (title) {
      publications.push({ title, citations, year });
    }
  }

  return publications;
}

// --- Compare ---
function compare(serpapi: ProfileData, scraper: ProfileData) {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Topic overlap
  const serpTopics = new Set(serpapi.topics.map(normalize));
  const scraperTopics = scraper.topics.map(normalize);
  const topicsOverlap = scraperTopics.filter((t) => serpTopics.has(t)).length;

  // Top paper title matches (fuzzy — first 40 chars)
  const serpTitles = serpapi.topPapers.map((p) => normalize(p.title).slice(0, 40));
  const topPaperTitleMatches = scraper.topPapers.filter((p) =>
    serpTitles.some((st) => normalize(p.title).slice(0, 40) === st)
  ).length;

  const pubCountDiff = Math.abs(serpapi.publicationCount - scraper.publicationCount);
  const pubCountPercent = serpapi.publicationCount > 0
    ? Math.round((pubCountDiff / serpapi.publicationCount) * 100)
    : 0;

  const citationsDiff = Math.abs(serpapi.totalCitations - scraper.totalCitations);
  const citationsPercent = serpapi.totalCitations > 0
    ? Math.round((citationsDiff / serpapi.totalCitations) * 100)
    : 0;

  return {
    name: normalize(serpapi.name) === normalize(scraper.name),
    affiliation: normalize(serpapi.affiliation) === normalize(scraper.affiliation),
    hasImage: !!scraper.imageUrl,
    topicsOverlap,
    topicsTotal: serpapi.topics.length,
    pubCountSerpapi: serpapi.publicationCount,
    pubCountScraper: scraper.publicationCount,
    pubCountDiff,
    pubCountPercent,
    citationsDiff,
    citationsPercent,
    topPaperTitleMatches,
    hasCitationGraph: scraper.hasCitationGraph,
    hIndexMatch: serpapi.hIndex === scraper.hIndex || serpapi.hIndex === -1,
    i10IndexMatch: serpapi.i10Index === scraper.i10Index || serpapi.i10Index === -1,
  };
}

// --- Main ---
async function main() {
  if (!SUPABASE_KEY) {
    console.error('Set SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY env var');
    process.exit(1);
  }

  console.log('=== Scraper Validation Report ===\n');
  console.log(`Testing ${TEST_PROFILES.length} profiles across 4 size categories...\n`);

  const results: ComparisonResult[] = [];

  for (const profile of TEST_PROFILES) {
    console.log(`--- ${profile.label} ---`);

    const serpapi = await fetchCachedData(profile.user);
    if (!serpapi) {
      console.log('  [SKIP] No cached SerpAPI data\n');
      results.push({
        label: profile.label,
        userId: profile.user,
        serpapi: null,
        scraper: null,
        scraperError: 'No cached data to compare against',
        matches: null,
      });
      continue;
    }

    console.log(`  SerpAPI: ${serpapi.name}, ${serpapi.publicationCount} pubs, ${serpapi.totalCitations} cit`);

    // Wait 3-6s between scrapes to avoid CAPTCHA
    const delay = 3000 + Math.random() * 3000;
    await new Promise((r) => setTimeout(r, delay));

    let scraper: ProfileData | null = null;
    let scraperError: string | null = null;

    try {
      scraper = await scrapeProfile(profile.user);
      console.log(`  Scraper: ${scraper.name}, ${scraper.publicationCount} pubs, ${scraper.totalCitations} cit`);
    } catch (e) {
      scraperError = e instanceof Error ? e.message : String(e);
      console.log(`  Scraper: FAILED - ${scraperError}`);
    }

    let matches = null;
    if (serpapi && scraper) {
      matches = compare(serpapi, scraper);
      console.log(`  Name match:        ${matches.name ? 'YES' : 'NO'}`);
      console.log(`  Affiliation match: ${matches.affiliation ? 'YES' : 'NO'}`);
      console.log(`  Profile image:     ${matches.hasImage ? 'YES' : 'NO'}`);
      console.log(`  Topics overlap:    ${matches.topicsOverlap}/${matches.topicsTotal}`);
      console.log(`  Pub count:         ${matches.pubCountSerpapi} vs ${matches.pubCountScraper} (diff: ${matches.pubCountDiff}, ${matches.pubCountPercent}%)`);
      console.log(`  Citations:         ${serpapi.totalCitations} vs ${scraper.totalCitations} (diff: ${matches.citationsDiff}, ${matches.citationsPercent}%)`);
      console.log(`  Top 5 papers:      ${matches.topPaperTitleMatches}/5 matched`);
      console.log(`  Citation graph:    ${matches.hasCitationGraph ? 'YES' : 'NO'}`);
      console.log(`  h-index:           ${serpapi.hIndex} vs ${scraper.hIndex} ${matches.hIndexMatch ? 'MATCH' : 'MISMATCH'}`);
      console.log(`  i10-index:         ${serpapi.i10Index} vs ${scraper.i10Index} ${matches.i10IndexMatch ? 'MATCH' : 'MISMATCH'}`);
    }

    results.push({ label: profile.label, userId: profile.user, serpapi, scraper, scraperError, matches });
    console.log('');
  }

  // ============ SUMMARY ============
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60) + '\n');

  const successful = results.filter((r) => r.scraper !== null);
  const failed = results.filter((r) => r.scraperError !== null && r.serpapi !== null);
  const skipped = results.filter((r) => r.serpapi === null);

  console.log(`Profiles tested:    ${TEST_PROFILES.length}`);
  console.log(`Scraper succeeded:  ${successful.length}`);
  console.log(`Scraper failed:     ${failed.length}`);
  console.log(`Skipped (no cache): ${skipped.length}`);

  if (failed.length > 0) {
    console.log(`\nFailures:`);
    failed.forEach((f) => console.log(`  - ${f.label}: ${f.scraperError}`));
  }

  if (successful.length > 0) {
    const nameMatches = successful.filter((r) => r.matches?.name).length;
    const affMatches = successful.filter((r) => r.matches?.affiliation).length;
    const imageCount = successful.filter((r) => r.matches?.hasImage).length;
    const graphCount = successful.filter((r) => r.matches?.hasCitationGraph).length;

    const avgPubDiff = Math.round(
      successful.reduce((s, r) => s + (r.matches?.pubCountPercent ?? 0), 0) / successful.length
    );
    const avgCitDiff = Math.round(
      successful.reduce((s, r) => s + (r.matches?.citationsPercent ?? 0), 0) / successful.length
    );
    const avgTopPapers = (
      successful.reduce((s, r) => s + (r.matches?.topPaperTitleMatches ?? 0), 0) / successful.length
    ).toFixed(1);

    console.log(`\n--- Accuracy ---`);
    console.log(`Name:               ${nameMatches}/${successful.length}`);
    console.log(`Affiliation:        ${affMatches}/${successful.length}`);
    console.log(`Profile image:      ${imageCount}/${successful.length}`);
    console.log(`Citation graph:     ${graphCount}/${successful.length}`);
    console.log(`Avg pub count dev:  ${avgPubDiff}%`);
    console.log(`Avg citation dev:   ${avgCitDiff}%`);
    console.log(`Avg top-5 matched:  ${avgTopPapers}/5`);

    // Per-size-category breakdown
    const categories = [
      { name: 'Small (<20)', profiles: successful.filter(r => (r.serpapi?.publicationCount ?? 0) < 20) },
      { name: 'Medium (20-60)', profiles: successful.filter(r => { const n = r.serpapi?.publicationCount ?? 0; return n >= 20 && n < 60; }) },
      { name: 'Large (60-100)', profiles: successful.filter(r => { const n = r.serpapi?.publicationCount ?? 0; return n >= 60 && n <= 100; }) },
      { name: 'Very Large (100+)', profiles: successful.filter(r => (r.serpapi?.publicationCount ?? 0) > 100) },
    ];

    console.log(`\n--- By Size Category ---`);
    for (const cat of categories) {
      if (cat.profiles.length === 0) continue;
      const avgPub = Math.round(cat.profiles.reduce((s, r) => s + (r.matches?.pubCountPercent ?? 0), 0) / cat.profiles.length);
      const avgCit = Math.round(cat.profiles.reduce((s, r) => s + (r.matches?.citationsPercent ?? 0), 0) / cat.profiles.length);
      const names = cat.profiles.filter(r => r.matches?.name).length;
      console.log(`  ${cat.name}: ${cat.profiles.length} profiles, name ${names}/${cat.profiles.length}, pub dev ${avgPub}%, cit dev ${avgCit}%`);
    }

    // Pagination analysis
    console.log(`\n--- Pagination Analysis ---`);
    for (const r of successful) {
      const serpPubs = r.serpapi?.publicationCount ?? 0;
      const scrPubs = r.scraper?.publicationCount ?? 0;
      const pct = serpPubs > 0 ? Math.round((scrPubs / serpPubs) * 100) : 0;
      const status = pct >= 90 ? 'GOOD' : pct >= 50 ? 'PARTIAL' : 'POOR';
      console.log(`  ${r.label}: ${scrPubs}/${serpPubs} pubs scraped (${pct}%) — ${status}`);
    }
  }

  // Verdict
  const successRate = successful.length / (successful.length + failed.length) || 0;
  const avgPubDevAll = successful.length > 0
    ? successful.reduce((s, r) => s + (r.matches?.pubCountPercent ?? 0), 0) / successful.length
    : 100;

  console.log('\n' + '='.repeat(60));
  if (failed.length === 0 && successful.length === TEST_PROFILES.length) {
    console.log('  VERDICT: ALL PASSED');
  } else if (successRate >= 0.8 && avgPubDevAll < 30) {
    console.log('  VERDICT: MOSTLY RELIABLE');
  } else if (successRate >= 0.5) {
    console.log('  VERDICT: PARTIAL — needs improvement');
  } else {
    console.log('  VERDICT: UNRELIABLE — majority failed');
  }
  console.log(`  Success rate: ${Math.round(successRate * 100)}%, Avg pub deviation: ${Math.round(avgPubDevAll)}%`);
  console.log('='.repeat(60));
}

main().catch(console.error);
