import type { Publication, CoAuthorGeoData } from '../../types/scholar';
import { RateLimiter } from '../scholar/rate-limiter';

const API_URL = 'https://api.openalex.org';
const EMAIL = 'scholarfolio@scholarfolio.org';

const geoRateLimiter = new RateLimiter(5000, 10);
const HEADERS = {
  'User-Agent': `ScholarFolio/1.0 (mailto:${EMAIL})`
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    await geoRateLimiter.acquireToken();
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

interface WorkAuthorship {
  author: { id: string; display_name: string };
  institutions: Array<{
    id: string;
    display_name: string;
    country_code: string;
  }>;
}

interface WorkResult {
  authorships: WorkAuthorship[];
}

interface InstitutionResult {
  geo?: { latitude?: number; longitude?: number };
}

/**
 * Fetches co-author geo data using a works-based approach:
 * 1. Find main author's OpenAlex ID
 * 2. Fetch all their works → extract co-author IDs + institution IDs (already disambiguated)
 * 3. Match co-authors to publication names from ScholarFolio data
 * 4. Batch-fetch institution geo for unique institution IDs
 */
export async function fetchCoAuthorGeoData(
  authorName: string,
  _authorAffiliation: string,
  publications: Publication[]
): Promise<{ mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] }> {
  // Step 1: Find the main author's OpenAlex ID
  const authorSearch = await fetchJson<{ results: Array<{ id: string }> }>(
    `${API_URL}/authors?search=${encodeURIComponent(authorName)}&per_page=1&select=id&mailto=${EMAIL}`
  );
  const mainAuthorOaId = authorSearch?.results?.[0]?.id;
  if (!mainAuthorOaId) return { mainAuthor: null, coAuthors: [] };

  const shortId = mainAuthorOaId.replace('https://openalex.org/', '');

  // Step 2: Fetch works with authorships (paginated, up to 200 per page)
  const allAuthorships: WorkAuthorship[] = [];
  let page = 1;
  while (page <= 5) {
    const worksData = await fetchJson<{ results: WorkResult[] }>(
      `${API_URL}/works?filter=authorships.author.id:${shortId}&per_page=200&page=${page}&select=authorships&mailto=${EMAIL}`
    );
    if (!worksData?.results?.length) break;
    for (const work of worksData.results) {
      allAuthorships.push(...work.authorships);
    }
    if (worksData.results.length < 200) break;
    page++;
  }

  // Step 3: Build co-author map with their most recent institution
  // Match OpenAlex names to ScholarFolio publication names
  const mainAuthorFreq = new Map<string, number>();
  for (const pub of publications) {
    for (const a of pub.authors) {
      mainAuthorFreq.set(a, (mainAuthorFreq.get(a) || 0) + 1);
    }
  }
  const mainAuthorKey = [...mainAuthorFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? authorName;

  // Count shared papers/citations from ScholarFolio data
  const coAuthorStats = new Map<string, { papers: number; citations: number }>();
  for (const pub of publications) {
    for (const a of pub.authors.filter(a => a !== mainAuthorKey)) {
      const existing = coAuthorStats.get(a) ?? { papers: 0, citations: 0 };
      coAuthorStats.set(a, { papers: existing.papers + 1, citations: existing.citations + pub.citations });
    }
  }

  // From OpenAlex authorships, collect unique co-authors with their institution
  // Use author ID to deduplicate, pick most frequent institution
  interface CoAuthorInfo {
    oaId: string;
    displayName: string;
    institutionId: string;
    institutionName: string;
    countryCode: string;
    count: number;
  }

  const coAuthorInstitutions = new Map<string, CoAuthorInfo>();
  for (const authorship of allAuthorships) {
    if (authorship.author.id === mainAuthorOaId) continue;
    const inst = authorship.institutions[0];
    if (!inst?.id || !inst.display_name || !inst.country_code) continue;

    const existing = coAuthorInstitutions.get(authorship.author.id);
    if (!existing || authorship.institutions.length > 0) {
      const prev = existing?.count ?? 0;
      coAuthorInstitutions.set(authorship.author.id, {
        oaId: authorship.author.id,
        displayName: authorship.author.display_name,
        institutionId: inst.id,
        institutionName: inst.display_name,
        countryCode: inst.country_code,
        count: prev + 1
      });
    }
  }

  // Match OpenAlex display names to ScholarFolio co-author names (fuzzy last-name match)
  const normalize = (name: string) => name.toLowerCase().trim();
  const getLastName = (name: string) => {
    const parts = name.split(/\s+/);
    return normalize(parts[parts.length - 1]);
  };

  interface MatchedCoAuthor {
    sfName: string;
    oaInfo: CoAuthorInfo;
    papers: number;
    citations: number;
  }

  const matched: MatchedCoAuthor[] = [];
  const usedOaIds = new Set<string>();

  for (const [sfName, stats] of coAuthorStats) {
    // Try exact match first, then last-name match
    let bestMatch: CoAuthorInfo | null = null;
    for (const info of coAuthorInstitutions.values()) {
      if (usedOaIds.has(info.oaId)) continue;
      if (normalize(info.displayName) === normalize(sfName)) {
        bestMatch = info;
        break;
      }
    }
    if (!bestMatch) {
      const sfLast = getLastName(sfName);
      for (const info of coAuthorInstitutions.values()) {
        if (usedOaIds.has(info.oaId)) continue;
        if (getLastName(info.displayName) === sfLast) {
          bestMatch = info;
          break;
        }
      }
    }
    if (bestMatch) {
      usedOaIds.add(bestMatch.oaId);
      matched.push({ sfName, oaInfo: bestMatch, papers: stats.papers, citations: stats.citations });
    }
  }

  // Sort by shared papers and take top 20
  matched.sort((a, b) => b.papers - a.papers);
  const top20 = matched.slice(0, 20);

  // Also find main author's institution from OpenAlex authorships
  let mainInstitutionId: string | null = null;
  let mainInstitutionName: string | null = null;
  let mainCountryCode: string | null = null;
  for (const authorship of allAuthorships) {
    if (authorship.author.id === mainAuthorOaId && authorship.institutions.length > 0) {
      const inst = authorship.institutions[0];
      if (inst.id && inst.display_name && inst.country_code) {
        mainInstitutionId = inst.id;
        mainInstitutionName = inst.display_name;
        mainCountryCode = inst.country_code;
        break;
      }
    }
  }

  // Step 4: Collect unique institution IDs and batch-fetch their geo
  const uniqueInstIds = new Set<string>();
  if (mainInstitutionId) uniqueInstIds.add(mainInstitutionId);
  for (const m of top20) {
    uniqueInstIds.add(m.oaInfo.institutionId);
  }

  const geoCache = new Map<string, { lat: number; lng: number }>();
  const geoPromises = [...uniqueInstIds].map(async instId => {
    const sid = instId.replace('https://openalex.org/', '');
    const data = await fetchJson<InstitutionResult>(
      `${API_URL}/institutions/${sid}?select=geo&mailto=${EMAIL}`
    );
    if (data?.geo?.latitude != null && data?.geo?.longitude != null) {
      geoCache.set(instId, { lat: data.geo.latitude, lng: data.geo.longitude });
    }
  });
  await Promise.all(geoPromises);

  // Build results
  let mainAuthor: CoAuthorGeoData | null = null;
  if (mainInstitutionId && mainInstitutionName && mainCountryCode) {
    const geo = geoCache.get(mainInstitutionId);
    if (geo) {
      mainAuthor = {
        name: authorName,
        institution: mainInstitutionName,
        countryCode: mainCountryCode,
        lat: geo.lat,
        lng: geo.lng,
        sharedPapers: 0,
        sharedCitations: 0
      };
    }
  }

  const coAuthors: CoAuthorGeoData[] = [];
  for (const m of top20) {
    const geo = geoCache.get(m.oaInfo.institutionId);
    if (!geo) continue;
    coAuthors.push({
      name: m.sfName,
      institution: m.oaInfo.institutionName,
      countryCode: m.oaInfo.countryCode,
      lat: geo.lat,
      lng: geo.lng,
      sharedPapers: m.papers,
      sharedCitations: m.citations
    });
  }

  return { mainAuthor, coAuthors };
}
