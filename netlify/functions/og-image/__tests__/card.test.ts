import { describe, expect, it } from 'vitest';
import { buildCardSvg, wrapText } from '../card.ts';
import { cardInputFor } from '../data.ts';

describe('wrapText', () => {
  it('wraps on word boundaries', () => {
    expect(wrapText('one two three four', 9, 3)).toEqual(['one two', 'three', 'four']);
  });

  it('truncates with an ellipsis past the line limit', () => {
    const lines = wrapText('alpha beta gamma delta epsilon', 11, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('cuts a single overlong word', () => {
    expect(wrapText('Supercalifragilistic', 8, 1)).toEqual(['Superca…']);
  });
});

describe('buildCardSvg', () => {
  it('renders name, metrics and url, escaping text', () => {
    const svg = buildCardSvg({ name: 'A <b>&', affiliation: 'Uni', totalCitations: 12345, hIndex: 7, urlLabel: 'scholarfolio.org/a' });
    expect(svg).toContain('A &lt;b&gt;&amp;');
    expect(svg).toContain('12,345');
    expect(svg).toContain('h-index');
    expect(svg).not.toContain('i10-index'); // missing metrics are omitted
    expect(svg).toContain('scholarfolio.org/a');
  });

  it('shrinks long names instead of overflowing', () => {
    const svg = buildCardSvg({ name: 'Maximiliane Alexandra von Hohenzollern-Sigmaringen Bartholomew', urlLabel: 'x' });
    expect(svg).not.toContain('font-size="76" fill="#ffffff"');
  });
});

describe('cardInputFor', () => {
  it('prefers cached data and labels claimed profiles with their slug', () => {
    const input = cardInputFor('ID', { data: { name: 'Ada', hIndex: 3 }, claim: { slug: 'ada', display_name: null } });
    expect(input?.name).toBe('Ada');
    expect(input?.urlLabel).toBe('scholarfolio.org/ada');
  });

  it('falls back to the default card for names the bundled fonts cannot draw', () => {
    expect(cardInputFor('ID', { data: { name: '王小明' }, claim: null })).toBeNull();
    expect(cardInputFor('ID', { data: null, claim: null })).toBeNull();
  });
});
