import { describe, expect, it } from 'vitest';
import { nameToSlug } from '../profileSlug';

describe('nameToSlug', () => {
  it('keeps plain ASCII names as before', () => {
    expect(nameToSlug('Jonas Heller')).toBe('jonas-heller');
    expect(nameToSlug("  Mary-Jane O'Neil ")).toBe('mary-jane-o-neil');
  });

  it('transliterates accented letters instead of dropping them', () => {
    expect(nameToSlug('Frédéric Dufays')).toBe('frederic-dufays');
    expect(nameToSlug('José Núñez')).toBe('jose-nunez');
    expect(nameToSlug('Zoë Müller')).toBe('zoe-muller');
    expect(nameToSlug('Søren Weiß')).toBe('soren-weiss');
    expect(nameToSlug('Łukasz Wałęsa')).toBe('lukasz-walesa');
  });

  it('never ends in a hyphen after truncation', () => {
    const slug = nameToSlug('Abcdefghij Abcdefghij Abcdefghij Abcdefgh Xyz');
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });
});
