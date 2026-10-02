import { describe, expect, it, vi } from 'vitest';
import { buildNwo } from '../narrativeCv/nwo';
import type { Author } from '../../types/scholar';

// The narrative generator needs a full metrics object; return representative prose.
vi.mock('../../lib/narrative/paragraphs', () => ({
  generateNarrativeParagraphs: () => [
    'Ada Lovelace is a researcher. Ada has 900 citations, yielding an h-index of **12**.',
    'Most papers are co-authored, with 40 unique co-authors.',
  ],
}));

const textOf = (value: unknown): string => JSON.stringify(value);

describe('NWO CV builder', () => {
  const authors = Array.from({ length: 9 }, (_, i) => `Author ${i + 1}`);
  const data = {
    name: 'Ada Lovelace',
    affiliation: 'Analytical Engine Lab',
    topics: [],
    publications: [{ title: 'Notes on the engine', authors, venue: 'Taylor', year: 1843, citations: 100, url: '' }],
  } as unknown as Author;
  const text = textOf(buildNwo(data, null, undefined));

  it('lists all authors without et al.', () => {
    expect(text).toContain(authors.join(', '));
    expect(text).not.toContain('et al.');
  });

  it('contains no prestige ranking language or author-level metrics', () => {
    for (const banned of ['prestige', 'h-index', '900 citations', 'Impact Factor', 'top journal']) {
      expect(text).not.toContain(banned);
    }
    expect(text).toContain('Ada Lovelace is a researcher.');
  });
});
