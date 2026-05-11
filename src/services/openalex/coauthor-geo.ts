import type { Publication, CoAuthorGeoData } from '../../types/scholar';
import { RateLimiter } from '../scholar/rate-limiter';

const API_URL = 'https://api.openalex.org';
const EMAIL = 'scholarfolio@scholarfolio.org';

// Dedicated limiter: OpenAlex polite pool allows ~10 req/sec with mailto
const geoRateLimiter = new RateLimiter(5000, 10);
const HEADERS = {
  'User-Agent': `ScholarFolio/1.0 (mailto:${EMAIL})`
};

interface InstitutionRef {
  id?: string;
  display_name?: string;
  country_code?: string;
}

interface InstitutionGeo {
  latitude?: number;
  longitude?: number;
}

async function fetchJson(url: string): Promise<unknown> {
  await geoRateLimiter.acquireToken();
  const response = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  return response.json();
}

/** Look up an author's institution ID via OpenAlex */
async function resolveAuthorInstitution(
  name: string
): Promise<InstitutionRef | null> {
  try {
    const data = await fetchJson(
      `${API_URL}/authors?search=${encodeURIComponent(name)}&per_page=1&select=last_known_institutions&mailto=${EMAIL}`
    ) as { results?: Array<{ last_known_institutions?: InstitutionRef[] }> } | null;
    if (!data) return null;

    const inst = data.results?.[0]?.last_known_institutions?.[0];
    if (!inst?.id || !inst.display_name) return null;
    return inst;
  } catch {
    return null;
  }
}

/** Fetch geo coordinates for an institution by its OpenAlex ID */
async function fetchInstitutionGeo(
  institutionId: string
): Promise<InstitutionGeo | null> {
  try {
    const shortId = institutionId.replace('https://openalex.org/', '');
    const data = await fetchJson(
      `${API_URL}/institutions/${shortId}?select=geo&mailto=${EMAIL}`
    ) as { geo?: InstitutionGeo } | null;
    if (!data) return null;
    return data.geo ?? null;
  } catch {
    return null;
  }
}

async function resolveAuthorGeo(
  name: string,
  sharedPapers: number,
  sharedCitations: number
): Promise<CoAuthorGeoData | null> {
  // Step 1: find the author's institution
  const inst = await resolveAuthorInstitution(name);
  if (!inst?.id || !inst.display_name || !inst.country_code) return null;

  // Step 2: get the institution's geo coordinates
  const geo = await fetchInstitutionGeo(inst.id);
  if (geo?.latitude == null || geo?.longitude == null) return null;

  return {
    name,
    institution: inst.display_name,
    countryCode: inst.country_code,
    lat: geo.latitude,
    lng: geo.longitude,
    sharedPapers,
    sharedCitations
  };
}

export async function fetchCoAuthorGeoData(
  authorName: string,
  _authorAffiliation: string,
  publications: Publication[]
): Promise<{ mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] }> {
  // Identify the main author as the most frequent name across publications
  const freq = new Map<string, number>();
  for (const pub of publications) {
    for (const author of pub.authors) {
      freq.set(author, (freq.get(author) || 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const mainAuthorKey = sorted[0]?.[0] ?? authorName;

  // Count co-author shared papers and citations, excluding main author
  const coAuthorMap = new Map<string, { papers: number; citations: number }>();
  for (const pub of publications) {
    const coAuthors = pub.authors.filter(a => a !== mainAuthorKey);
    for (const coAuthor of coAuthors) {
      const existing = coAuthorMap.get(coAuthor) ?? { papers: 0, citations: 0 };
      coAuthorMap.set(coAuthor, {
        papers: existing.papers + 1,
        citations: existing.citations + pub.citations
      });
    }
  }

  // Sort by shared paper count, take top 20
  const top20 = [...coAuthorMap.entries()]
    .sort((a, b) => b[1].papers - a[1].papers)
    .slice(0, 20);

  // Resolve all in parallel (each does 2 API calls: author → institution)
  const [mainAuthor, ...coAuthorResults] = await Promise.all([
    resolveAuthorGeo(authorName, 0, 0),
    ...top20.map(([name, data]) =>
      resolveAuthorGeo(name, data.papers, data.citations)
    )
  ]);

  const coAuthors = coAuthorResults.filter((r): r is CoAuthorGeoData => r !== null);

  return { mainAuthor, coAuthors };
}
