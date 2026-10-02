// Pure helpers for the name search. Kept import-free so the browser test suite
// (vitest) can exercise them directly; the edge function imports them with a
// .ts specifier, which Deno requires.

export interface SearchCandidate {
  name: string;
  affiliation: string;
  imageUrl: string;
  authorId: string;
  citedBy: number;
  interests: string[];
  /** A paper of theirs from the search result, so people can tell two
   *  same-named researchers apart without a paid profile call per candidate. */
  knownFor?: string;
}

interface SerpAuthorRef { name?: string; author_id?: string }
interface SerpOrganicResult {
  title?: string;
  publication_info?: { summary?: string; authors?: SerpAuthorRef[] };
}
export interface SerpScholarSearchResponse {
  organic_results?: SerpOrganicResult[];
  /** "User profiles for ..." block GS shows above results for some queries. */
  profiles?: { authors?: SerpAuthorRef[] };
}

export const MAX_SEARCH_CANDIDATES = 8;

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function nameMatchesQuery(candidateName: string, query: string): boolean {
  const queryParts = stripDiacritics(query.toLowerCase().trim()).split(/\s+/);
  const candidateParts = stripDiacritics(candidateName.toLowerCase().trim()).split(/\s+/);

  return queryParts.every(qp =>
    candidateParts.some(cp =>
      cp.includes(qp) || qp.includes(cp) ||
      (cp.length === 1 && qp.startsWith(cp)) ||
      (qp.length === 1 && cp.startsWith(qp))
    )
  );
}

/** Year from a GS summary line like "J Heller, K de Ruyter - Journal of X, 2020 - Elsevier". */
function yearFromSummary(summary: string): string {
  const m = summary.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}

function emptyCandidate(authorId: string, name: string): SearchCandidate {
  // Affiliation, photo, citations and interests only exist on the author
  // profile; the search modal already hides each of these when empty.
  return { name, affiliation: '', imageUrl: '', authorId, citedBy: 0, interests: [] };
}

/**
 * Turn ONE google_scholar search response into author candidates without
 * fetching any author profile. Previously each candidate cost an extra paid
 * google_scholar_author call just to show affiliation and citation count; the
 * profile the user actually picks is fetched (and cached) by the normal lookup.
 * Profile-block entries come first (full names), then authors of matching papers
 * in result order, so `results[0]` stays the most likely person for callers that
 * auto-open the top hit.
 */
export function extractSearchCandidates(
  data: SerpScholarSearchResponse,
  query: string,
  limit = MAX_SEARCH_CANDIDATES,
): SearchCandidate[] {
  const byId = new Map<string, SearchCandidate>();

  for (const author of data.profiles?.authors ?? []) {
    if (!author.author_id || byId.has(author.author_id)) continue;
    if (!nameMatchesQuery(author.name || '', query)) continue;
    byId.set(author.author_id, emptyCandidate(author.author_id, author.name || ''));
  }

  for (const result of data.organic_results ?? []) {
    const year = yearFromSummary(result.publication_info?.summary || '');
    const paper = result.title ? `${result.title}${year ? ` (${year})` : ''}` : '';
    for (const author of result.publication_info?.authors ?? []) {
      if (!author.author_id) continue;
      const existing = byId.get(author.author_id);
      if (existing) {
        if (!existing.knownFor && paper) existing.knownFor = paper;
        continue;
      }
      if (!nameMatchesQuery(author.name || '', query)) continue;
      const candidate = emptyCandidate(author.author_id, author.name || '');
      if (paper) candidate.knownFor = paper;
      byId.set(author.author_id, candidate);
    }
  }

  return [...byId.values()].slice(0, limit);
}

/** How many top candidates get a paid profile call for affiliation/citations.
 *  Affiliation is the main way people tell namesakes apart, but each preview is
 *  a paid google_scholar_author call: 2 keeps a search at most 3 calls (was 5)
 *  while the most likely matches still show where they work. */
export const PREVIEW_PROFILE_LIMIT = 2;

interface SerpAuthorProfile {
  author?: {
    name?: string;
    affiliations?: string;
    thumbnail?: string;
    interests?: Array<{ title?: string } | string>;
  };
  cited_by?: { table?: Array<{ citations?: { all?: number } }> };
}

/** Fill a candidate's profile-only fields from a google_scholar_author response.
 *  Returns the candidate unchanged when the response has no author block. */
export function applyProfilePreview(candidate: SearchCandidate, profile: SerpAuthorProfile): SearchCandidate {
  const author = profile.author;
  if (!author) return candidate;
  return {
    ...candidate,
    // Profile names are full ("Jonas Heller"); paper-author names are often initials.
    name: author.name || candidate.name,
    affiliation: author.affiliations || candidate.affiliation,
    imageUrl: author.thumbnail || candidate.imageUrl,
    citedBy: profile.cited_by?.table?.[0]?.citations?.all ?? candidate.citedBy,
    interests: (author.interests ?? [])
      .map(i => (typeof i === 'string' ? i : i.title || ''))
      .filter(Boolean),
  };
}
