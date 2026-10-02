import { friendlyProfileError, nameQueryForFailedLookup } from '../profileErrors';

describe('friendlyProfileError', () => {
  test('never echoes the raw upstream message', () => {
    const copy = friendlyProfileError('FETCH_ERROR');
    expect(copy.message).not.toMatch(/SerpAPI|HTTP \d/);
    expect(copy.title).toBeTruthy();
  });

  test('has specific copy for rate limits', () => {
    expect(friendlyProfileError('RATE_LIMITED').title).toMatch(/Too many/);
  });

  test('falls back for unknown or missing codes', () => {
    expect(friendlyProfileError(undefined)).toEqual(friendlyProfileError('SOMETHING_NEW'));
  });
});

describe('nameQueryForFailedLookup', () => {
  test('prefers the known name', () => {
    expect(nameQueryForFailedLookup(' Ada Lovelace ', '/ada-l')).toBe('Ada Lovelace');
  });

  test('derives a name from a vanity slug', () => {
    expect(nameQueryForFailedLookup(undefined, '/jonas-heller')).toBe('jonas heller');
  });

  test('is empty for an id-only deep link', () => {
    expect(nameQueryForFailedLookup(undefined, '/scholar/abcdefghijkl')).toBe('');
  });
});
