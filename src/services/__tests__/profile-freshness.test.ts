import { describe, it, expect } from 'vitest';
import { fetchedAtFromExpiry } from '../profile-freshness';

describe('fetchedAtFromExpiry', () => {
  const now = new Date('2026-10-02T12:00:00Z');

  it('subtracts the 14-day cache TTL', () => {
    expect(fetchedAtFromExpiry('2026-10-10T12:00:00Z', now)?.toISOString()).toBe('2026-09-26T12:00:00.000Z');
  });

  it('never returns a future date', () => {
    expect(fetchedAtFromExpiry('2026-11-01T00:00:00Z', now)).toEqual(now);
  });

  it('returns null for garbage', () => {
    expect(fetchedAtFromExpiry('not a date', now)).toBeNull();
  });
});
