import type { Author, Publication } from '../../types/scholar';
import { buildAuthorResult, type AuthorSearchResult } from '../scholar/index';
import { oaFetchJson, OA_API_URL, OA_EMAIL } from './author-lookup';

/**
 * OpenAlex fallback profile source.
 *
 * When Google Scholar is unavailable (SerpAPI empty + scrape blocked), we can
 * still build a full ScholarFolio profile from OpenAlex's open dataset. These
 * profiles are namespaced with an `openalex:` identifier prefix so the rest of
 * the app can route them without colliding with Google Scholar user IDs.
 */

export const OPENALEX_ID_PREFIX = 'openalex:';

/** Strip the `openalex:` prefix and any OpenAlex URL wrapper, returning the bare id (e.g. "A5023888391"). */
export function toOpenAlexShortId(identifier: string): string {
  return identifier
    .replace(OPENALEX_ID_PREFIX, '')
    .replace('https://openalex.org/', '')
    .trim();
}

interface OaAuthorRecord {
  id: string;
  display_name: string;
  works_count?: number;
  cited_by_count?: number;
  summary_stats?: { h_index?: number; i10_index?: number };
  last_known_institutions?: Array<{ display_name?: string }>;
  affiliations?: Array<{ institution?: { display_name?: string }; years?: number[] }>;
  counts_by_year?: Array<{ year: number; cited_by_count: number }>;
  topics?: Array<{ id: string; display_name: string; count?: number }>;
  x_concepts?: Array<{ id: string; display_name: string; score?: number }>;
}

interface OaWork {
  title?: string;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  doi?: string;
  id?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { source?: { display_name?: string } };
}

const SELECT_AUTHOR = 'id,display_name,works_count,cited_by_count,summary_stats,last_known_institutions,affiliations,counts_by_year,topics,x_concepts';
const SELECT_WORK = 'title,display_name,publication_year,cited_by_count,doi,id,authorships,primary_location';
const MAX_WORKS = 400;

/**
 * Search OpenAlex for authors by name, returning candidates shaped like Scholar
 * search results. Used as a last-resort fallback when Scholar search hard-fails.
 */
export async function searchOpenAlexAuthors(query: string): Promise<AuthorSearchResult[]> {
  const data = await oaFetchJson<{ results: OaAuthorRecord[] }>(
    `${OA_API_URL}/authors?search=${encodeURIComponent(query)}&per_page=10&select=${SELECT_AUTHOR}&mailto=${OA_EMAIL}`,
    10000
  );

  const results = data?.results;
  if (!results?.length) return [];

  return results
    .filter(a => (a.works_count ?? 0) > 0)
    .map(a => ({
      name: a.display_name,
      affiliation: affiliationOf(a),
      imageUrl: '',
      authorId: OPENALEX_ID_PREFIX + a.id.replace('https://openalex.org/', ''),
      citedBy: a.cited_by_count ?? 0,
      interests: interestsOf(a),
    }));
}

/**
 * Build a full Author profile from an OpenAlex author id (with or without the
 * `openalex:` prefix). Fetches the author record plus their most-cited works and
 * runs them through the same metrics pipeline used for Google Scholar profiles.
 */
export async function fetchOpenAlexProfile(identifier: string): Promise<Author> {
  const shortId = toOpenAlexShortId(identifier);
  // OpenAlex author ids are always "A" followed by digits. Validate before
  // interpolating into request URLs so a crafted ?user= token can't inject.
  if (!/^A\d+$/.test(shortId)) {
    throw new Error('Invalid OpenAlex author id');
  }
  const fullId = `https://openalex.org/${shortId}`;

  const author = await oaFetchJson<OaAuthorRecord>(
    `${OA_API_URL}/authors/${shortId}?select=${SELECT_AUTHOR}&mailto=${OA_EMAIL}`,
    15000
  );
  if (!author) {
    throw new Error('OpenAlex author not found');
  }

  // Most-cited works first so a bounded fetch still captures everything that
  // drives h-index / i10 / citation charts for prolific authors.
  const works: OaWork[] = [];
  let cursor = '*';
  while (works.length < MAX_WORKS && cursor) {
    const page = await oaFetchJson<{ results: OaWork[]; meta?: { next_cursor?: string } }>(
      `${OA_API_URL}/works?filter=authorships.author.id:${fullId}` +
      `&select=${SELECT_WORK}&sort=cited_by_count:desc&per_page=200&cursor=${encodeURIComponent(cursor)}&mailto=${OA_EMAIL}`,
      15000
    );
    const batch = page?.results ?? [];
    works.push(...batch);
    cursor = batch.length > 0 ? (page?.meta?.next_cursor ?? '') : '';
  }

  const publications: Publication[] = works
    .filter(w => w.title || w.display_name)
    .map(w => ({
      title: (w.title || w.display_name || '').trim(),
      authors: (w.authorships || [])
        .map(a => a.author?.display_name || '')
        .filter(Boolean),
      venue: w.primary_location?.source?.display_name || '',
      year: w.publication_year || 0,
      citations: w.cited_by_count ?? 0,
      url: workUrl(w),
    }));

  // Real citations-per-year straight from OpenAlex's author counts.
  const citationsPerYear: Record<string, number> = {};
  for (const c of author.counts_by_year || []) {
    if (c.year) citationsPerYear[String(c.year)] = c.cited_by_count;
  }

  return buildAuthorResult({
    name: author.display_name,
    affiliation: affiliationOf(author),
    imageUrl: undefined,
    topics: interestsOf(author).map(name => ({ name, url: '', paperCount: 0 })),
    hIndex: author.summary_stats?.h_index ?? 0,
    totalCitations: author.cited_by_count ?? 0,
    publications,
    metrics: { citationsPerYear, citationGraphSource: 'cited_by_graph' },
    cacheStatus: 'miss',
  });
}

function affiliationOf(a: OaAuthorRecord): string {
  const lastKnown = (a.last_known_institutions ?? [])
    .map(i => i.display_name)
    .filter((n): n is string => Boolean(n));

  if (lastKnown.length === 0) {
    return a.affiliations?.[0]?.institution?.display_name || '';
  }
  if (lastKnown.length === 1) return lastKnown[0];

  // OpenAlex often returns several "last known" institutions when it isn't sure
  // which is current (e.g. a scholar with visiting/adjunct roles). Its ordering
  // isn't meaningful, so picking [0] can surface a short visiting stint over a
  // decades-long home institution. Rank the candidates by how long the author
  // has actually published under each (years in `affiliations`), tie-breaking on
  // recency. This only re-ranks within OpenAlex's own candidate set, so it can
  // never surface a misattributed one-off institution.
  const tenure = new Map<string, { years: number; recent: number }>();
  for (const aff of a.affiliations ?? []) {
    const name = aff.institution?.display_name;
    if (!name) continue;
    const years = aff.years ?? [];
    tenure.set(name, { years: years.length, recent: years.length ? Math.max(...years) : 0 });
  }

  return lastKnown.reduce((best, name) => {
    const s = tenure.get(name) ?? { years: 0, recent: 0 };
    const b = tenure.get(best) ?? { years: 0, recent: 0 };
    if (s.years > b.years || (s.years === b.years && s.recent > b.recent)) return name;
    return best;
  }, lastKnown[0]);
}

function interestsOf(a: OaAuthorRecord): string[] {
  const fromTopics = (a.topics || []).map(t => t.display_name).filter(Boolean);
  if (fromTopics.length) return fromTopics.slice(0, 8);
  return (a.x_concepts || []).map(c => c.display_name).filter(Boolean).slice(0, 8);
}

function workUrl(w: OaWork): string {
  if (w.doi) return w.doi.startsWith('http') ? w.doi : `https://doi.org/${w.doi}`;
  return w.id || '';
}
