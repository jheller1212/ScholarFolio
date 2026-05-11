import type { Publication, CoAuthorGeoData } from '../../types/scholar';
import { rateLimiter } from '../scholar/rate-limiter';

const API_URL = 'https://api.openalex.org';
const EMAIL = 'scholarfolio@scholarfolio.org';
const HEADERS = {
  'User-Agent': `ScholarFolio/1.0 (mailto:${EMAIL})`
};

interface OpenAlexInstitution {
  display_name?: string;
  country_code?: string;
  geo?: {
    latitude?: number;
    longitude?: number;
  };
}

interface OpenAlexAuthorResult {
  last_known_institutions?: OpenAlexInstitution[];
}

async function resolveAuthorGeo(
  name: string,
  sharedPapers: number,
  sharedCitations: number
): Promise<CoAuthorGeoData | null> {
  try {
    await rateLimiter.acquireToken();
    const url = `${API_URL}/authors?search=${encodeURIComponent(name)}&per_page=1&mailto=${EMAIL}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;

    const data = await response.json();
    const result: OpenAlexAuthorResult | undefined = data.results?.[0];
    if (!result) return null;

    const institution = result.last_known_institutions?.[0];
    if (!institution) return null;

    const { display_name, country_code, geo } = institution;
    if (!display_name || !country_code || geo?.latitude == null || geo?.longitude == null) {
      return null;
    }

    return {
      name,
      institution: display_name,
      countryCode: country_code,
      lat: geo.latitude,
      lng: geo.longitude,
      sharedPapers,
      sharedCitations
    };
  } catch {
    return null;
  }
}

export async function fetchCoAuthorGeoData(
  authorName: string,
  authorAffiliation: string,
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

  // Resolve all co-authors and main author in parallel (non-blocking per item)
  const [mainAuthor, ...coAuthorResults] = await Promise.all([
    resolveAuthorGeo(authorName, 0, 0).then(result => {
      // Override name/affiliation hint not available from API — just use what we got
      return result;
    }),
    ...top20.map(([name, data]) =>
      resolveAuthorGeo(name, data.papers, data.citations)
    )
  ]);

  const coAuthors = coAuthorResults.filter((r): r is CoAuthorGeoData => r !== null);

  return { mainAuthor, coAuthors };
}
