/**
 * Full Scraper Validation — tests against ALL cached SerpAPI profiles
 *
 * Run: SUPABASE_ANON_KEY=<key> npx tsx scripts/validate-scraper-full.ts
 *
 * Rate limits: 5-8s between scrapes to avoid CAPTCHA.
 * ~330 profiles ≈ 35-45 minutes.
 */

const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const SCRAPER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache',
};

interface CachedProfile {
  userId: string;
  name: string;
  affiliation: string;
  imageUrl: string;
  topics: string[];
  pubCount: number;
  totalCitations: number;
  topPapers: Array<{ title: string; citations: number }>;
}

interface ScrapeResult {
  name: string;
  affiliation: string;
  imageUrl: string;
  topics: string[];
  pubCount: number;
  totalCitations: number;
  topPapers: Array<{ title: string; citations: number }>;
  hasCitationGraph: boolean;
  hIndex: number;
  i10Index: number;
}

interface TestResult {
  userId: string;
  cachedName: string;
  pubCountCached: number;
  success: boolean;
  error?: string;
  nameMatch?: boolean;
  pubCountScraped?: number;
  pubCountDiffPct?: number;
  citDiffPct?: number;
  topPaperMatches?: number;
  hasImage?: boolean;
  hasCitGraph?: boolean;
}

// Fetch ALL cached profiles from Supabase
async function fetchAllCached(): Promise<CachedProfile[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/scholar_cache?select=url,data&data->>name=not.is.null&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!response.ok) throw new Error(`Supabase: HTTP ${response.status}`);
  const rows: Array<{ url: string; data: any }> = await response.json();

  return rows.map(row => {
    const userMatch = row.url.match(/user=([^&]+)/);
    const pubs = row.data.publications || [];
    return {
      userId: userMatch?.[1] || '',
      name: row.data.name || '',
      affiliation: row.data.affiliation || '',
      imageUrl: row.data.imageUrl || '',
      topics: (row.data.topics || []).map((t: any) => t.name || t),
      pubCount: pubs.length,
      totalCitations: pubs.reduce((s: number, p: any) => s + (p.citations || 0), 0),
      topPapers: pubs
        .sort((a: any, b: any) => (b.citations || 0) - (a.citations || 0))
        .slice(0, 5)
        .map((p: any) => ({ title: p.title || '', citations: p.citations || 0 })),
    };
  }).filter(p => p.userId);
}

// Scrape a single profile (first page only for speed — sufficient for validation)
async function scrapeProfile(userId: string): Promise<ScrapeResult> {
  const url = `https://scholar.google.com/citations?user=${userId}&hl=en&cstart=0&pagesize=100`;
  const response = await fetch(url, {
    headers: SCRAPER_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();

  if (html.includes('unusual traffic') || html.includes('please show you') || html.includes('automated access')) {
    throw new Error('CAPTCHA');
  }
  if (!html.includes('gsc_prf_in')) {
    throw new Error('Profile not found');
  }

  const name = html.match(/id="gsc_prf_in"[^>]*>([^<]+)/)?.[1]?.trim() || '';

  // Affiliation: get full text including nested <a> tags
  const affBlock = html.match(/class="gsc_prf_il"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
  const affiliation = affBlock.replace(/<[^>]+>/g, '').trim();

  // Image: use srcset
  const srcset = html.match(/id="gsc_prf_pup-img"[^>]*srcset="([^"]+)"/)?.[1] || '';
  const imageUrl = srcset.split(/\s+/)[0] || html.match(/id="gsc_prf_pup-img"[^>]*src="([^"]+)"/)?.[1] || '';

  // Topics
  const topicSection = html.match(/id="gsc_prf_int"[\s\S]*?<\/div>/)?.[0] || '';
  const topics = [...topicSection.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(m => m[1].trim());

  // Publications (first page only)
  const pubs: Array<{ title: string; citations: number }> = [];
  const pubMatches = [...html.matchAll(/class="gsc_a_tr"[\s\S]*?<\/tr>/g)];
  for (const match of pubMatches) {
    const row = match[0];
    const title = row.match(/class="gsc_a_at"[^>]*>([^<]+)/)?.[1]?.trim() || '';
    const citMatch = row.match(/class="gsc_a_c"[^>]*><a[^>]*>(\d+)/);
    const citations = citMatch ? parseInt(citMatch[1]) : 0;
    if (title) pubs.push({ title, citations });
  }

  // Citation graph
  const yearLabels = [...html.matchAll(/class="gsc_g_t"[^>]*>(\d{4})<\/span>/g)];
  const hasCitationGraph = yearLabels.length > 0;

  // h-index & i10-index from stats table
  const statCells = [...html.matchAll(/class="gsc_rsb_std"[^>]*>(\d*)<\/td>/g)].map(m => parseInt(m[1]) || 0);
  const hIndex = statCells.length >= 3 ? statCells[2] : 0;
  const i10Index = statCells.length >= 5 ? statCells[4] : 0;

  const totalCitations = pubs.reduce((s, p) => s + p.citations, 0);

  return {
    name, affiliation, imageUrl, topics,
    pubCount: pubs.length,
    totalCitations,
    topPapers: pubs.sort((a, b) => b.citations - a.citations).slice(0, 5),
    hasCitationGraph,
    hIndex, i10Index,
  };
}

function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

async function main() {
  if (!SUPABASE_KEY) { console.error('Set SUPABASE_ANON_KEY'); process.exit(1); }

  console.log('Fetching all cached profiles from Supabase...');
  const cached = await fetchAllCached();
  console.log(`Found ${cached.length} cached profiles.\n`);

  const results: TestResult[] = [];
  let captchaStreak = 0;

  for (let i = 0; i < cached.length; i++) {
    const profile = cached[i];
    const progress = `[${i + 1}/${cached.length}]`;

    // If we hit 3 CAPTCHAs in a row, stop
    if (captchaStreak >= 3) {
      console.log(`\n${progress} STOPPING — 3 consecutive CAPTCHAs. Tested ${i} profiles.`);
      break;
    }

    // Rate limit: 5-8s between requests
    if (i > 0) {
      const delay = 5000 + Math.random() * 3000;
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const scraped = await scrapeProfile(profile.userId);
      captchaStreak = 0;

      const nameMatch = normalize(scraped.name) === normalize(profile.name);
      const pubCountDiffPct = profile.pubCount > 0
        ? Math.round(Math.abs(scraped.pubCount - Math.min(profile.pubCount, 100)) / Math.min(profile.pubCount, 100) * 100)
        : 0;
      const citDiffPct = profile.totalCitations > 0
        ? Math.round(Math.abs(scraped.totalCitations - profile.totalCitations) / profile.totalCitations * 100)
        : 0;

      // Top paper matches (first 40 chars normalized)
      const cachedTitles = profile.topPapers.map(p => normalize(p.title).slice(0, 40));
      const topPaperMatches = scraped.topPapers.filter(p =>
        cachedTitles.some(ct => normalize(p.title).slice(0, 40) === ct)
      ).length;

      const status = nameMatch ? 'OK' : 'NAME_MISMATCH';
      console.log(`${progress} ${status} ${profile.name} — pubs: ${profile.pubCount} cached / ${scraped.pubCount} scraped, img: ${scraped.imageUrl ? 'Y' : 'N'}, graph: ${scraped.hasCitationGraph ? 'Y' : 'N'}, top5: ${topPaperMatches}/5`);

      results.push({
        userId: profile.userId,
        cachedName: profile.name,
        pubCountCached: profile.pubCount,
        success: true,
        nameMatch,
        pubCountScraped: scraped.pubCount,
        pubCountDiffPct,
        citDiffPct,
        topPaperMatches,
        hasImage: !!scraped.imageUrl,
        hasCitGraph: scraped.hasCitationGraph,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      if (err === 'CAPTCHA') captchaStreak++;
      else captchaStreak = 0;

      console.log(`${progress} FAIL ${profile.name} — ${err}`);
      results.push({
        userId: profile.userId,
        cachedName: profile.name,
        pubCountCached: profile.pubCount,
        success: false,
        error: err,
      });
    }
  }

  // ============ REPORT ============
  const ok = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const captchas = failed.filter(r => r.error === 'CAPTCHA');
  const otherFails = failed.filter(r => r.error !== 'CAPTCHA');

  console.log('\n' + '='.repeat(60));
  console.log('  FULL VALIDATION REPORT');
  console.log('='.repeat(60));
  console.log(`\nProfiles tested:     ${results.length} / ${cached.length}`);
  console.log(`Succeeded:           ${ok.length} (${Math.round(ok.length / results.length * 100)}%)`);
  console.log(`Failed - CAPTCHA:    ${captchas.length}`);
  console.log(`Failed - other:      ${otherFails.length}`);

  if (otherFails.length > 0) {
    console.log(`\nNon-CAPTCHA failures:`);
    otherFails.forEach(r => console.log(`  - ${r.cachedName}: ${r.error}`));
  }

  if (ok.length > 0) {
    const nameMatches = ok.filter(r => r.nameMatch).length;
    const avgPubDiff = Math.round(ok.reduce((s, r) => s + (r.pubCountDiffPct ?? 0), 0) / ok.length);
    const avgCitDiff = Math.round(ok.reduce((s, r) => s + (r.citDiffPct ?? 0), 0) / ok.length);
    const avgTopPapers = (ok.reduce((s, r) => s + (r.topPaperMatches ?? 0), 0) / ok.length).toFixed(1);
    const imageCount = ok.filter(r => r.hasImage).length;
    const graphCount = ok.filter(r => r.hasCitGraph).length;

    console.log(`\n--- Accuracy (${ok.length} successful) ---`);
    console.log(`Name match:          ${nameMatches}/${ok.length} (${Math.round(nameMatches / ok.length * 100)}%)`);
    console.log(`Profile image:       ${imageCount}/${ok.length} (${Math.round(imageCount / ok.length * 100)}%)`);
    console.log(`Citation graph:      ${graphCount}/${ok.length} (${Math.round(graphCount / ok.length * 100)}%)`);
    console.log(`Avg pub count dev:   ${avgPubDiff}%  (first page only — max 100)`);
    console.log(`Avg citation dev:    ${avgCitDiff}%  (first page citations only)`);
    console.log(`Avg top-5 matched:   ${avgTopPapers}/5`);

    // Size breakdown
    const sizeGroups = [
      { name: 'Tiny (1-10)', filter: (r: TestResult) => r.pubCountCached <= 10 },
      { name: 'Small (11-30)', filter: (r: TestResult) => r.pubCountCached > 10 && r.pubCountCached <= 30 },
      { name: 'Medium (31-100)', filter: (r: TestResult) => r.pubCountCached > 30 && r.pubCountCached <= 100 },
      { name: 'Large (101-300)', filter: (r: TestResult) => r.pubCountCached > 100 && r.pubCountCached <= 300 },
      { name: 'XL (300+)', filter: (r: TestResult) => r.pubCountCached > 300 },
    ];

    console.log(`\n--- By Profile Size ---`);
    for (const g of sizeGroups) {
      const group = ok.filter(g.filter);
      if (group.length === 0) continue;
      const names = group.filter(r => r.nameMatch).length;
      const imgs = group.filter(r => r.hasImage).length;
      console.log(`  ${g.name.padEnd(18)} ${group.length} profiles, name ${names}/${group.length}, image ${imgs}/${group.length}`);
    }

    // Name mismatches
    const nameMismatches = ok.filter(r => !r.nameMatch);
    if (nameMismatches.length > 0) {
      console.log(`\n--- Name Mismatches ---`);
      nameMismatches.forEach(r => console.log(`  ${r.cachedName} (${r.userId})`));
    }
  }

  const successRate = ok.length / Math.max(1, results.length);
  console.log('\n' + '='.repeat(60));
  if (successRate >= 0.95) console.log('  VERDICT: EXCELLENT — scraper is production-ready');
  else if (successRate >= 0.85) console.log('  VERDICT: GOOD — reliable with occasional CAPTCHA');
  else if (successRate >= 0.7) console.log('  VERDICT: FAIR — works but CAPTCHA risk at scale');
  else console.log('  VERDICT: POOR — too many failures');
  console.log(`  ${ok.length}/${results.length} succeeded (${Math.round(successRate * 100)}%)`);
  console.log('='.repeat(60));
}

main().catch(console.error);
