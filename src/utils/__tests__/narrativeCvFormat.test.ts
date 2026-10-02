import { describe, expect, it } from 'vitest';
import {
  doiFor, doiUrl, dropMetricSentences, formatAuthors, isOA, normalizeDoi, normalizeTitle, orcidDateRange, selectKeyOutputs, stripMarkdown, topicNames,
} from '../narrativeCv/format';
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

describe('DOIs', () => {
  it('normalises the usual DOI spellings and rejects non-DOIs', () => {
    expect(normalizeDoi('10.1000/xyz.1')).toBe('10.1000/xyz.1');
    expect(normalizeDoi('https://doi.org/10.1000/ABC')).toBe('10.1000/ABC');
    expect(normalizeDoi('http://dx.doi.org/10.1000/abc')).toBe('10.1000/abc');
    expect(normalizeDoi('doi: 10.1000/abc')).toBe('10.1000/abc');
    expect(normalizeDoi('not a doi')).toBeNull();
    expect(normalizeDoi(undefined)).toBeNull();
  });

  it('looks DOIs up by normalised title and formats a resolver link', () => {
    const oa = { doiMap: { astudy: '10.5555/study' } } as unknown as OpenAccessStats;
    expect(doiFor(pub({ title: 'A Study!' }), oa)).toBe('10.5555/study');
    expect(doiFor(pub({ title: 'Other' }), oa)).toBeNull();
    expect(doiFor(pub(), undefined)).toBeNull();
    expect(doiUrl('10.5555/study')).toBe('https://doi.org/10.5555/study');
  });
});

describe('key output selection and author lists', () => {
  it('orders by citations then recency, ignoring journal rankings', () => {
    const ranked = pub({ title: 'Ranked', citations: 5, year: 2019, journalRanking: { ft50: true, abs: '4*' } as Publication['journalRanking'] });
    const cited = pub({ title: 'Cited', citations: 50, year: 2015 });
    const tieNew = pub({ title: 'Tie new', citations: 5, year: 2023 });
    expect(selectKeyOutputs([ranked, cited, tieNew]).map(p => p.title)).toEqual(['Cited', 'Tie new', 'Ranked']);
    expect(selectKeyOutputs(Array.from({ length: 15 }, (_, i) => pub({ title: `P${i}` })))).toHaveLength(10);
  });

  it('keeps full author lists unless a cap is given', () => {
    const authors = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    expect(formatAuthors(authors)).toBe('A, B, C, D, E, F, G, H');
    expect(formatAuthors(authors, 6)).toBe('A, B, C, D, E, F et al.');
    expect(formatAuthors([' A ', '', 'B'])).toBe('A, B');
  });

  it('drops sentences with author-level metrics', () => {
    const text = 'Ada studies **engines**. She has 1,200 citations, yielding an h-index of 12. Her work spans 10 years.';
    expect(dropMetricSentences(text)).toBe('Ada studies engines. Her work spans 10 years.');
  });
});
