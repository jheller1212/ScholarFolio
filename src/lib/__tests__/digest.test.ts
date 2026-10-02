import { describe, it, expect } from 'vitest';
import {
  diffSnapshots, parseSerpAuthor, parseCachedProfile, monthStart, titleKey,
  type StoredSnapshot,
} from '../../../supabase/functions/_shared/digest';

const snap = (over: Partial<StoredSnapshot>): StoredSnapshot => ({
  captured_month: '2026-10-01',
  gs_citations: 100,
  gs_h_index: 5,
  gs_i10_index: 3,
  gs_top_works: [],
  gs_source: 'serpapi',
  ...over,
});

describe('diffSnapshots', () => {
  it('reports citation growth, h-index change and the paper that gained most', () => {
    const prev = snap({ gs_top_works: [
      { key: 'a', title: 'A', citations: 50 },
      { key: 'b', title: 'B', citations: 30 },
    ] });
    const curr = snap({ captured_month: '2026-11-01', gs_citations: 112, gs_h_index: 6, gs_top_works: [
      { key: 'a', title: 'A', citations: 53 },
      { key: 'b', title: 'B', citations: 39 },
      { key: 'c', title: 'New', citations: 10 },
    ] });
    expect(diffSnapshots(prev, curr)).toEqual({
      citationsDelta: 12, citationsTotal: 112, hIndexBefore: 5, hIndexAfter: 6,
      topPaper: { title: 'B', gained: 9 },
    });
  });

  it('returns null when nothing changed', () => {
    expect(diffSnapshots(snap({}), snap({ captured_month: '2026-11-01' }))).toBeNull();
  });

  it('never reports a drop as news', () => {
    expect(diffSnapshots(snap({}), snap({ gs_citations: 90 }))).toBeNull();
  });

  it('refuses to diff across sources (cache sum vs official GS total)', () => {
    expect(diffSnapshots(snap({ gs_source: 'cache' }), snap({ gs_citations: 150 }))).toBeNull();
  });

  it('returns null when either side lacks GS numbers', () => {
    expect(diffSnapshots(snap({ gs_citations: null }), snap({ gs_citations: 150 }))).toBeNull();
  });
});

describe('parsers', () => {
  it('reads the SerpAPI cited_by table and articles', () => {
    const s = parseSerpAuthor({
      cited_by: { table: [
        { citations: { all: 1234, since_2021: 400 } },
        { h_index: { all: 15 } },
        { i10_index: { all: 20 } },
      ] },
      articles: [{ title: 'Paper Ö', cited_by: { value: 7 } }, { title: 'Big', cited_by: { value: 99 } }],
    });
    expect(s?.citations).toBe(1234);
    expect(s?.hIndex).toBe(15);
    expect(s?.i10Index).toBe(20);
    expect(s?.topWorks[0]).toEqual({ key: 'big', title: 'Big', citations: 99 });
    expect(s?.topWorks[1].key).toBe('paper o');
  });

  it('returns null for a SerpAPI response without a citations table', () => {
    expect(parseSerpAuthor({ articles: [] })).toBeNull();
  });

  it('reads a scholar_cache payload', () => {
    const s = parseCachedProfile({
      totalCitations: 40, metrics: { hIndex: 3, i10Index: 1 },
      publications: [{ title: 'X', citations: 40 }],
    });
    expect(s).toEqual({ citations: 40, hIndex: 3, i10Index: 1, topWorks: [{ key: 'x', title: 'X', citations: 40 }] });
  });
});

describe('helpers', () => {
  it('monthStart is the first of the UTC month', () => {
    expect(monthStart(new Date(Date.UTC(2026, 10, 30, 23)))).toBe('2026-11-01');
  });
  it('titleKey ignores case, accents and punctuation', () => {
    expect(titleKey('Über: The "Thing"!')).toBe(titleKey('uber the thing'));
  });
});
