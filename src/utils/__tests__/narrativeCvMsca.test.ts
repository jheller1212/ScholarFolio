import { describe, expect, it, vi } from 'vitest';
import { buildMsca } from '../narrativeCv/msca';
import type { Author } from '../../types/scholar';

vi.mock('../../lib/narrative/paragraphs', () => ({
  generateNarrativeParagraphs: () => ['Ada Lovelace is a researcher.'],
}));

describe('MSCA CV builder', () => {
  const data = {
    name: 'Ada Lovelace',
    affiliation: 'Analytical Engine Lab',
    topics: [],
    publications: [{ title: 'Notes on the engine', authors: ['Ada Lovelace'], venue: 'Taylor', year: 1843, citations: 100, url: '' }],
  } as unknown as Author;
  const text = JSON.stringify(buildMsca(data, null, undefined));

  it('describes outputs qualitatively instead of by citation counts', () => {
    expect(text).not.toContain('100 citations');
    expect(text).toContain('qualitative note on its scientific significance');
  });

  it('states the indicative five-page length rather than "no limit"', () => {
    expect(text).toContain('indicative length 5 pages');
    expect(text).not.toContain('No strict page limit');
  });
});
