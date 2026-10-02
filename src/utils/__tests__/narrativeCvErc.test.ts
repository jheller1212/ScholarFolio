import { describe, expect, it, vi } from 'vitest';
import { buildErc } from '../narrativeCv/erc';

// The narrative generator needs a full metrics object; its prose is not under test here.
vi.mock('../../lib/narrative/paragraphs', () => ({
  generateNarrativeParagraphs: () => ['Ada works on **engines**, with an h-index of 12.'],
}));
import type { Author } from '../../types/scholar';

// docx Paragraph objects keep their runs' text in a serialisable tree.
const textOf = (value: unknown): string => JSON.stringify(value);

describe('ERC CV builder', () => {
  const data = {
    name: 'Ada Lovelace',
    affiliation: 'Analytical Engine Lab',
    topics: [],
    publications: [],
    metrics: {},
  } as unknown as Author;

  it('uses the three sections of the ERC template, in order', () => {
    const text = textOf(buildErc(data, null, '0000-0001-2345-6789'));
    const order = ['Personal Details', 'Research Achievements and Peer Recognition', 'Additional Information'].map(h => text.indexOf(h));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).toContain('ORCID 0000-0001-2345-6789');
  });

  it('drops the pre-2025 PI-profile sections', () => {
    const text = textOf(buildErc(data, null, undefined));
    expect(text).not.toContain('Narrative on Track Record');
    expect(text).not.toContain('journal prestige');
  });
});
