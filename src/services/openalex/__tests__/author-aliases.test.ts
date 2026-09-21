import { vi } from 'vitest';
import { fetchOpenAlexProfile } from '../profile';
import { openAlexRecordsFor } from '../author-aliases';
import { oaFetchJson } from '../author-lookup';

vi.mock('../author-lookup', () => ({
  oaFetchJson: vi.fn(),
  OA_API_URL: 'https://api.openalex.org',
  OA_EMAIL: 'test@example.com',
}));

const mockFetch = vi.mocked(oaFetchJson);

const CANONICAL = 'A5044727833';
const VARIANT = 'A5141099083';

const RECORDS: Record<string, object> = {
  [CANONICAL]: {
    id: `https://openalex.org/${CANONICAL}`,
    display_name: 'Elizabeth M. Beekman',
    works_count: 2,
    cited_by_count: 22,
    summary_stats: { h_index: 2 },
    counts_by_year: [{ year: 2025, cited_by_count: 9 }],
  },
  [VARIANT]: {
    id: `https://openalex.org/${VARIANT}`,
    display_name: 'Elizabeth Maria Beekman',
    works_count: 1,
    cited_by_count: 3,
    summary_stats: { h_index: 1 },
    counts_by_year: [{ year: 2025, cited_by_count: 1 }, { year: 2026, cited_by_count: 2 }],
  },
};

const work = (title: string, cited: number) => ({
  id: `https://openalex.org/W${cited}`, title, publication_year: 2024, cited_by_count: cited, type: 'article',
});

describe('split OpenAlex author records', () => {
  let worksUrl = '';

  beforeEach(() => {
    worksUrl = '';
    mockFetch.mockImplementation((async (url: string) => {
      if (url.includes('/works?')) {
        worksUrl = url;
        return { results: [work('A', 14), work('B', 8), work('C', 3)], meta: {} };
      }
      const id = url.match(/\/authors\/(A\d+)/)?.[1];
      return id ? RECORDS[id] ?? null : null;
    }) as typeof oaFetchJson);
  });

  it('leaves an author with no known duplicates alone', () => {
    expect(openAlexRecordsFor('A1')).toEqual(['A1']);
  });

  // The reported case: the visitor opened the two-work record and saw a
  // fraction of their publications.
  it('shows the same complete profile whichever record the visitor opened', async () => {
    const profile = await fetchOpenAlexProfile(`openalex:${VARIANT}`);

    expect(worksUrl).toContain(
      `authorships.author.id:https://openalex.org/${CANONICAL}|https://openalex.org/${VARIANT}`
    );
    expect(profile.name).toBe('Elizabeth M. Beekman');
    expect(profile.publications).toHaveLength(3);
    expect(profile.totalCitations).toBe(25);
    // Citations 14, 8, 3 → h = 3; adding the per-record h-indexes would be wrong.
    expect(profile.hIndex).toBe(3);
    expect(profile.metrics.citationsPerYear).toMatchObject({ '2025': 10, '2026': 2 });
  });
});
