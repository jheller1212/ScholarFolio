import {
  applyProfilePreview,
  extractSearchCandidates,
  nameMatchesQuery,
  MAX_SEARCH_CANDIDATES,
} from '../../../../supabase/functions/scholar/searchCandidates.ts';

describe('nameMatchesQuery', () => {
  it('matches initials, diacritics and partial tokens', () => {
    expect(nameMatchesQuery('J Heller', 'Jonas Heller')).toBe(true);
    expect(nameMatchesQuery('Jörg Müller', 'jorg muller')).toBe(true);
    expect(nameMatchesQuery('K de Ruyter', 'Ko de Ruyter')).toBe(true);
  });

  it('rejects a different surname', () => {
    expect(nameMatchesQuery('J Smith', 'Jonas Heller')).toBe(false);
  });
});

describe('extractSearchCandidates', () => {
  const response = {
    organic_results: [
      {
        title: 'Touching the untouchable',
        publication_info: {
          summary: 'J Heller, M Chylinski, K de Ruyter - Journal of Retailing, 2019 - Elsevier',
          authors: [
            { name: 'J Heller', author_id: 'AAAAAAAAAAAA' },
            { name: 'M Chylinski', author_id: 'BBBBBBBBBBBB' },
          ],
        },
      },
      {
        title: 'Second paper',
        publication_info: {
          summary: 'J Heller - Some Journal, 2021',
          authors: [{ name: 'J Heller', author_id: 'AAAAAAAAAAAA' }],
        },
      },
      {
        title: 'Namesake paper',
        publication_info: {
          summary: 'J Heller - Physics, 2010',
          authors: [{ name: 'J Heller', author_id: 'CCCCCCCCCCCC' }, { name: 'No Id' }],
        },
      },
    ],
  };

  it('returns only authors matching the query, deduped, in result order', () => {
    const out = extractSearchCandidates(response, 'Jonas Heller');
    expect(out.map(c => c.authorId)).toEqual(['AAAAAAAAAAAA', 'CCCCCCCCCCCC']);
  });

  it('attaches the first matching paper as knownFor and leaves profile-only fields empty', () => {
    const [first] = extractSearchCandidates(response, 'Jonas Heller');
    expect(first).toEqual({
      name: 'J Heller',
      affiliation: '',
      imageUrl: '',
      authorId: 'AAAAAAAAAAAA',
      citedBy: 0,
      interests: [],
      knownFor: 'Touching the untouchable (2019)',
    });
  });

  it('puts the GS profile block first and enriches it from organic results', () => {
    const out = extractSearchCandidates(
      { ...response, profiles: { authors: [{ name: 'JA Heller', author_id: 'CCCCCCCCCCCC' }] } },
      'Heller',
    );
    expect(out[0]).toMatchObject({ authorId: 'CCCCCCCCCCCC', knownFor: 'Namesake paper (2010)' });
  });

  it('handles an empty response and caps the list', () => {
    expect(extractSearchCandidates({}, 'anyone')).toEqual([]);
    const many = {
      organic_results: Array.from({ length: 20 }, (_, i) => ({
        title: `P${i}`,
        publication_info: { authors: [{ name: 'A Smith', author_id: `ID${String(i).padStart(10, '0')}` }] },
      })),
    };
    expect(extractSearchCandidates(many, 'Smith')).toHaveLength(MAX_SEARCH_CANDIDATES);
  });
});

describe('applyProfilePreview', () => {
  const base = {
    name: 'J Heller', affiliation: '', imageUrl: '', authorId: 'AAAAAAAAAAAA',
    citedBy: 0, interests: [], knownFor: 'Touching the untouchable (2019)',
  };

  it('fills affiliation, full name, citations and interests from the profile', () => {
    const out = applyProfilePreview(base, {
      author: {
        name: 'Jonas Heller',
        affiliations: 'Maastricht University',
        thumbnail: 'https://img',
        interests: [{ title: 'Marketing' }, 'AR'],
      },
      cited_by: { table: [{ citations: { all: 1234 } }] },
    });
    expect(out).toEqual({
      ...base,
      name: 'Jonas Heller',
      affiliation: 'Maastricht University',
      imageUrl: 'https://img',
      citedBy: 1234,
      interests: ['Marketing', 'AR'],
    });
  });

  it('leaves the candidate unchanged when the profile has no author block', () => {
    expect(applyProfilePreview(base, {})).toBe(base);
  });
});
