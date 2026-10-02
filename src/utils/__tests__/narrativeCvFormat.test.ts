import { describe, expect, it } from 'vitest';
import { isOA, normalizeTitle, orcidDateRange, stripMarkdown, topicNames } from '../narrativeCv/format';
import type { Author, OpenAccessStats, Publication } from '../../types/scholar';

const pub = (over: Partial<Publication> = {}): Publication => ({
  title: 'A Study', authors: ['A. One'], venue: 'J', year: 2020, citations: 0, url: '', ...over,
});

describe('narrative CV format helpers', () => {
  it('strips bold markdown', () => {
    expect(stripMarkdown('**Bold** and **more**')).toBe('Bold and more');
  });

  it('normalises titles like the OpenAlex service', () => {
    expect(normalizeTitle('Deep Learning: A Review!')).toBe('deeplearningareview');
  });

  it('formats ORCID date ranges', () => {
    expect(orcidDateRange(null, 2020)).toBe('');
    expect(orcidDateRange(2018, null)).toBe('2018–present');
    expect(orcidDateRange(2018, 2021)).toBe('2018–2021');
  });

  it('reads open-access status by normalised title', () => {
    const oa = { publicationOa: { astudy: { status: 'gold' }, closedone: { status: 'closed' } } } as unknown as OpenAccessStats;
    expect(isOA(pub(), oa)).toBe(true);
    expect(isOA(pub({ title: 'Closed one' }), oa)).toBe(false);
    expect(isOA(pub(), undefined)).toBe(false);
  });

  it('flattens topic names of either shape', () => {
    const data = { topics: [{ name: 'Marketing' }, { name: { title: 'AI' } }, { name: '' }] } as unknown as Author;
    expect(topicNames(data)).toEqual(['Marketing', 'AI']);
  });
});
