import type { Publication, CoAuthorGeoData } from '../../types/scholar';
import { findOpenAlexAuthor, oaFetchJson, OA_API_URL, OA_EMAIL } from './author-lookup';
import { canonicalNameKey } from '../../utils/names';
import { isRealAuthorName, isSameResearcher } from '../../utils/authorIdentity';

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
 * 1. Find main author's OpenAlex ID (shared cached lookup)
 * 2. Fetch all their works -> extract co-author IDs + institution IDs
 * 3. Match co-authors to publication names from ScholarFolio data
 * 4. Batch-fetch institution geo for unique institution IDs
 */
export async function fetchCoAuthorGeoData(
  authorName: string,
  authorAffiliation: string,
  publications: Publication[]
): Promise<{ mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] }> {
  // Use shared author lookup (cached across services)
  const author = await findOpenAlexAuthor(authorName, authorAffiliation);
  if (!author) return { mainAuthor: null, coAuthors: [] };

  const mainAuthorOaId = author.id;
  const mainCurrentInst = author.lastKnownInstitutions[0];
  const shortId = mainAuthorOaId.replace('https://openalex.org/', '');

  // Step 2: Fetch works with authorships (paginated, up to 200 per page)
  const allAuthorships: WorkAuthorship[] = [];
  let page = 1;
  while (page <= 5) {
    const worksData = await oaFetchJson<{ results: WorkResult[] }>(
      `${OA_API_URL}/works?filter=authorships.author.id:${shortId}&per_page=200&page=${page}&select=authorships&mailto=${OA_EMAIL}`
    );
    if (!worksData?.results?.length) break;
    for (const work of worksData.results) {
      allAuthorships.push(...work.authorships);
    }
    if (worksData.results.length < 200) break;
    page++;
  }

  // Step 3: Build co-author map with their most recent institution
  const normalize = (name: string) => canonicalNameKey(name);
  const getLastName = (name: string) => {
    const parts = canonicalNameKey(name).split(/\s+/);
    return parts[parts.length - 1] || '';
  };

  const mainAuthorFreq = new Map<string, number>();
  for (const pub of publications) {
    for (const a of (pub.authors || []).filter(isRealAuthorName)) {
      mainAuthorFreq.set(a, (mainAuthorFreq.get(a) || 0) + 1);
    }
  }
  const mainAuthorKey = [...mainAuthorFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? authorName;

  // Build a set of name variants that likely refer to the main author
  const mainNameVariants = new Set<string>();
  mainNameVariants.add(mainAuthorKey);
  for (const [name] of mainAuthorFreq) {
    // Shared identity check, so the map agrees with every other view about
    // which bylines are the profile owner.
    if (name !== mainAuthorKey && isSameResearcher(name, mainAuthorKey)) {
      mainNameVariants.add(name);
    }
  }

  // Count shared papers/citations from ScholarFolio data
  const coAuthorStats = new Map<string, { papers: number; citations: number }>();
  for (const pub of publications) {
    for (const a of (pub.authors || []).filter(a => isRealAuthorName(a) && !mainNameVariants.has(a))) {
      const existing = coAuthorStats.get(a) ?? { papers: 0, citations: 0 };
      coAuthorStats.set(a, { papers: existing.papers + 1, citations: existing.citations + pub.citations });
    }
  }

  // From OpenAlex authorships, collect unique co-authors with their institution
  interface CoAuthorInfo {
    oaId: string;
    displayName: string;
    institutionId: string;
    institutionName: string;
    countryCode: string;
    count: number;
  }

  const coAuthorInstitutions = new Map<string, CoAuthorInfo>();
  const mainNameLower = authorName.toLowerCase().trim();
  for (const authorship of allAuthorships) {
    if (authorship.author.id === mainAuthorOaId) continue;
    if (authorship.author.display_name.toLowerCase().trim() === mainNameLower) continue;
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
  interface MatchedCoAuthor {
    sfName: string;
    oaInfo: CoAuthorInfo;
    papers: number;
    citations: number;
  }

  const matched: MatchedCoAuthor[] = [];
  const usedOaIds = new Set<string>();

  const getNameTokens = (name: string) => new Set(normalize(name).split(/\s+/).filter(t => t.length > 1));

  for (const [sfName, stats] of coAuthorStats) {
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
    if (!bestMatch) {
      const sfTokens = getNameTokens(sfName);
      let bestOverlap = 0;
      for (const info of coAuthorInstitutions.values()) {
        if (usedOaIds.has(info.oaId)) continue;
        const oaTokens = getNameTokens(info.displayName);
        const overlap = [...sfTokens].filter(t => oaTokens.has(t)).length;
        if (overlap >= 2 && overlap > bestOverlap) {
          bestOverlap = overlap;
          bestMatch = info;
        }
      }
    }
    if (bestMatch) {
      usedOaIds.add(bestMatch.oaId);
      matched.push({ sfName, oaInfo: bestMatch, papers: stats.papers, citations: stats.citations });
    }
  }

  // Sort by shared papers and take top 50
  matched.sort((a, b) => b.papers - a.papers);
  const top50 = matched.slice(0, 50);

  const mainInstitutionId = mainCurrentInst?.id ?? null;
  const mainInstitutionName = mainCurrentInst?.display_name ?? null;
  const mainCountryCode = mainCurrentInst?.country_code ?? null;

  // Step 4: Collect unique institution IDs and batch-fetch their geo
  const uniqueInstIds = new Set<string>();
  if (mainInstitutionId) uniqueInstIds.add(mainInstitutionId);
  for (const m of top50) {
    uniqueInstIds.add(m.oaInfo.institutionId);
  }

  const geoCache = new Map<string, { lat: number; lng: number }>();
  const geoPromises = [...uniqueInstIds].map(async instId => {
    const sid = instId.replace('https://openalex.org/', '');
    const data = await oaFetchJson<InstitutionResult>(
      `${OA_API_URL}/institutions/${sid}?select=geo&mailto=${OA_EMAIL}`
    );
    if (data?.geo?.latitude != null && data?.geo?.longitude != null) {
      geoCache.set(instId, { lat: data.geo.latitude, lng: data.geo.longitude });
    }
  });
  await Promise.all(geoPromises);

  // Build results
  let mainAuthorGeo: CoAuthorGeoData | null = null;
  if (mainInstitutionId && mainInstitutionName && mainCountryCode) {
    const geo = geoCache.get(mainInstitutionId);
    if (geo) {
      mainAuthorGeo = {
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
  for (const m of top50) {
    const geo = geoCache.get(m.oaInfo.institutionId);
    if (!geo) continue;
    coAuthors.push({
      name: m.sfName,
      fullName: m.oaInfo.displayName,
      openalexId: m.oaInfo.oaId,
      institution: m.oaInfo.institutionName,
      countryCode: m.oaInfo.countryCode,
      lat: geo.lat,
      lng: geo.lng,
      sharedPapers: m.papers,
      sharedCitations: m.citations
    });
  }

  return { mainAuthor: mainAuthorGeo, coAuthors };
}
