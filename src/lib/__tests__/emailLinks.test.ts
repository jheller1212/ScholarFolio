import { describe, it, expect } from 'vitest';
import { tagEmailLinks } from '../../../supabase/functions/_shared/emailLinks';

const UTM = 'utm_source=email&utm_medium=email&utm_campaign=digest';

describe('tagEmailLinks', () => {
  it('tags site links in HTML and text, keeping trailing punctuation', () => {
    expect(tagEmailLinks('<a href="https://scholarfolio.org/ada">x</a>', 'digest'))
      .toBe(`<a href="https://scholarfolio.org/ada?${UTM}">x</a>`);
    expect(tagEmailLinks('Visit https://scholarfolio.org.', 'digest'))
      .toBe(`Visit https://scholarfolio.org/?${UTM}.`);
    expect(tagEmailLinks('See https://scholarfolio.org/?user=abc&amp;tab=cv now', 'report_fixed'))
      .toBe('See https://scholarfolio.org/?user=abc&amp;tab=cv&amp;utm_source=email&amp;utm_medium=email&amp;utm_campaign=report_fixed now');
  });

  it('leaves unsubscribe, already-tagged, encoded and foreign links alone', () => {
    const untouched = [
      '<a href="https://scholarfolio.org/unsubscribe?token=t">stop</a>',
      'https://scholarfolio.org/?utm_source=guide',
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fscholarfolio.org%2Fada',
      'https://scholar.google.com/citations?user=x',
    ];
    for (const s of untouched) expect(tagEmailLinks(s, 'digest')).toBe(s);
  });
});
