import { describe, expect, it } from 'vitest';
import { guideEntries, profileEntries, renderSitemap } from '../entries.ts';

const gs = (id: string) => `https://scholar.google.com/citations?user=${id}`;

describe('profileEntries', () => {
  it('lists claimed profiles by slug and other cached profiles by id, once each', () => {
    const entries = profileEntries(
      [{ slug: 'ada-lovelace', author_id: 'AAAAAAAAAAAA', updated_at: '2026-09-01T10:00:00Z' }],
      [
        { url: gs('AAAAAAAAAAAA'), created_at: '2026-09-30T10:00:00Z' },
        { url: gs('BBBBBBBBBBBB'), created_at: '2026-09-29T10:00:00Z' },
        { url: 'oa:/works?filter=x', created_at: '2026-09-29T10:00:00Z' },
      ],
    );
    expect(entries.map((e) => e.loc)).toEqual([
      'https://scholarfolio.org/ada-lovelace',
      'https://scholarfolio.org/scholar/BBBBBBBBBBBB',
    ]);
    // Claimed lastmod takes the newer of claim edit and cache refresh.
    expect(entries[0].lastmod).toBe('2026-09-30');
    expect(entries[1].lastmod).toBe('2026-09-29');
  });
});

describe('guideEntries', () => {
  it('reads the generated manifest shape', () => {
    const entries = guideEntries({ pages: [{ path: '/guides/', lastmod: '2026-10-02' }, { path: '/guides/x/' }] });
    expect(entries.map((e) => e.loc)).toEqual(['https://scholarfolio.org/guides/', 'https://scholarfolio.org/guides/x/']);
    expect(entries[0].lastmod).toBe('2026-10-02');
  });

  it('tolerates a missing or malformed manifest', () => {
    expect(guideEntries(null)).toEqual([]);
    expect(guideEntries('<html>')).toEqual([]);
    expect(guideEntries({ pages: [42, { path: 'https://evil.example/' }] })).toEqual([]);
    expect(guideEntries(['/guides/a/'])).toHaveLength(1);
  });
});

describe('renderSitemap', () => {
  it('escapes and de-duplicates locs', () => {
    const xml = renderSitemap([
      { loc: 'https://scholarfolio.org/a&b', changefreq: 'weekly', priority: '0.5' },
      { loc: 'https://scholarfolio.org/a&b', changefreq: 'weekly', priority: '0.5' },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toContain('a&amp;b');
    expect(xml).not.toContain('<lastmod>');
  });
});
