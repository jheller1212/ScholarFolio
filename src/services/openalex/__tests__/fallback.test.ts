import { vi } from 'vitest';
import { resolveOpenAlexFallback } from '../profile';
import { oaFetchJson } from '../author-lookup';

vi.mock('../author-lookup', () => ({
  oaFetchJson: vi.fn(),
  OA_API_URL: 'https://api.openalex.org',
  OA_EMAIL: 'test@example.com',
}));

// The profile build reads the author_aliases table; no test may reach a real project.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: async () => ({ data: [], error: null }) }) },
}));

const mockFetch = vi.mocked(oaFetchJson);

/** Minimal author-search payload: one OpenAlex record per (name, citations). */
function searchPayload(records: Array<{ id: string; name: string; cited: number }>) {
  return {
    results: records.map(r => ({
      id: `https://openalex.org/${r.id}`,
      display_name: r.name,
      works_count: 10,
      cited_by_count: r.cited,
      last_known_institutions: [],
      topics: [],
    })),
  };
}

/** Route each mocked request by URL shape: /authors?search=, /authors/<id>, /works. */
function routeRequests(searchRecords: Array<{ id: string; name: string; cited: number }>) {
  mockFetch.mockImplementation((async (url: string) => {
    if (url.includes('/authors?search=')) return searchPayload(searchRecords);
    if (url.includes('/works?')) return { results: [], meta: {} };
    const match = url.match(/\/authors\/(A\d+)/);
    if (match) {
      const rec = searchRecords.find(r => r.id === match[1]);
      return {
        id: `https://openalex.org/${match[1]}`,
        display_name: rec?.name ?? 'Unknown',
        works_count: 10,
        cited_by_count: rec?.cited ?? 0,
        summary_stats: { h_index: 3 },
        counts_by_year: [],
        last_known_institutions: [],
        topics: [],
      };
    }
    return null;
  }) as unknown as typeof oaFetchJson);
}

describe('resolveOpenAlexFallback', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('returns null when no candidate shares the requested surname', async () => {
    // The guard that matters: a claimed vanity URL must never render a
    // different researcher's publications just because Scholar was down.
    routeRequests([{ id: 'A1', name: 'Maria Lopez', cited: 900 }]);
    expect(await resolveOpenAlexFallback('Ivan Guitart')).toBeNull();
  });

  test('returns null when the search yields nothing', async () => {
    routeRequests([]);
    expect(await resolveOpenAlexFallback('Ivan Guitart')).toBeNull();
  });

  test('returns null for an unusable name', async () => {
    routeRequests([{ id: 'A1', name: 'Ivan Guitart', cited: 10 }]);
    expect(await resolveOpenAlexFallback('')).toBeNull();
  });

  test('prefers the most-cited matching record when a scholar is split across duplicates', async () => {
    // Mirrors a real report: one person held as two OpenAlex records, the
    // sparse one first in relevance order.
    routeRequests([
      { id: 'A5141099083', name: 'Elizabeth Maria Beekman', cited: 0 },
      { id: 'A5044727833', name: 'Elizabeth M. Beekman', cited: 30 },
    ]);
    const result = await resolveOpenAlexFallback('Elizabeth Beekman');
    expect(result?.id).toBe('openalex:A5044727833');
    expect(result?.profile.name).toBe('Elizabeth M. Beekman');
  });

  test('matches a hyphenated surname against its component form', async () => {
    routeRequests([{ id: 'A7', name: 'Miriam Pein-Hackelbusch', cited: 1238 }]);
    const result = await resolveOpenAlexFallback('miriam pein');
    expect(result?.id).toBe('openalex:A7');
  });

  test('returns null rather than throwing when the lookup fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    expect(await resolveOpenAlexFallback('Ivan Guitart')).toBeNull();
  });
});
