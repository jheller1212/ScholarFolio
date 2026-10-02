import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

import { applyProfileOverrides, hiddenWorkTitles, workTitleKey, type ProfileOverride } from '..';
import type { Author, Publication } from '../../../types/scholar';

const pub = (title: string): Publication => ({ title, authors: [], venue: '', year: 2020, citations: 1, url: '' });
const author = (titles: string[]): Author => ({
  name: 'Ada Lovelace', affiliation: 'Uni', topics: [], hIndex: 1, totalCitations: 2,
  publications: titles.map(pub), metrics: {} as Author['metrics'],
});
const ov = (field: string, value: unknown): ProfileOverride => ({ field, value, note: null, verified_via: 'orcid' });

describe('applyProfileOverrides', () => {
  it('hides papers by normalised title and marks the correction', () => {
    const out = applyProfileOverrides(author(['On Engines', 'Not Mine: A Study']), [ov('hide_work', { title: 'not mine — a study' })]);
    expect(out.publications.map(p => p.title)).toEqual(['On Engines']);
    expect(out.corrections?.map(c => c.field)).toEqual(['hide_work']);
  });

  it('applies title and pronouns', () => {
    const out = applyProfileOverrides(author([]), [ov('title', 'Associate Professor'), ov('pronouns', 'she')]);
    expect(out.title).toBe('Associate Professor');
    expect(out.pronouns).toBe('she');
  });

  it('ignores a hide_work that matches nothing', () => {
    const a = author(['On Engines']);
    const out = applyProfileOverrides(a, [ov('hide_work', { title: 'Something else' })]);
    expect(out.publications).toHaveLength(1);
    expect(out.corrections).toBeUndefined();
  });
});

describe('helpers', () => {
  it('hiddenWorkTitles accepts object and bare-string values', () => {
    expect(hiddenWorkTitles([ov('hide_work', { title: 'A' }), ov('hide_work', 'B'), ov('title', 'C')])).toEqual(['A', 'B']);
  });
  it('workTitleKey folds accents, case and punctuation', () => {
    expect(workTitleKey('Évaluation: "Test"')).toBe('evaluation test');
  });
});
