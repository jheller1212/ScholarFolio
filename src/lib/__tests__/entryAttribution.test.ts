import { deriveEntry, withRef, setPendingProfileEntry, takePendingProfileEntry } from '../entryAttribution';

const base = { userInitiated: false, ref: null, utmSource: null, referrerHost: 'direct' };

describe('deriveEntry', () => {
  test('an in-app search wins over link markers', () => {
    expect(deriveEntry({ ...base, userInitiated: true, ref: 'share', utmSource: 'email' })).toBe('search');
  });

  test.each(['share', 'badge', 'coauthor', 'trending'])('ref=%s', ref => {
    expect(deriveEntry({ ...base, ref, utmSource: 'email' })).toBe(ref);
  });

  test('ignores unknown ref values', () => {
    expect(deriveEntry({ ...base, ref: '<script>' })).toBe('direct');
  });

  test('falls back to utm_source, then referrer', () => {
    expect(deriveEntry({ ...base, utmSource: 'email' })).toBe('email');
    expect(deriveEntry({ ...base, utmSource: 'guide' })).toBe('guide');
    expect(deriveEntry({ ...base, utmSource: 'newsletter' })).toBe('campaign');
    expect(deriveEntry({ ...base, referrerHost: 'linkedin.com' })).toBe('referral');
    expect(deriveEntry({ ...base, referrerHost: 'internal' })).toBe('direct');
  });
});

describe('withRef', () => {
  test('adds, replaces and keeps other params and hash', () => {
    expect(withRef('https://scholarfolio.org/ada', 'share')).toBe('https://scholarfolio.org/ada?ref=share');
    expect(withRef('https://scholarfolio.org/ada?ref=badge', 'share')).toBe('https://scholarfolio.org/ada?ref=share');
    expect(withRef('/scholar/x?tab=cv#top', 'badge')).toBe('/scholar/x?tab=cv&ref=badge#top');
  });
});

describe('pending profile entry', () => {
  test('is read once, then defaults to direct', () => {
    setPendingProfileEntry('coauthor');
    expect(takePendingProfileEntry()).toBe('coauthor');
    expect(takePendingProfileEntry()).toBe('direct');
  });
});
