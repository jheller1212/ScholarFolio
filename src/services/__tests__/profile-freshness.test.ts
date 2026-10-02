import { describe, it, expect } from 'vitest';
import { fetchedAtFromExpiry, fetchedAtFromRow } from '../profile-freshness';

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

describe('fetchedAtFromRow', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  it('uses created_at when it is the later signal (row refreshed after the change)', () => {
    const d = fetchedAtFromRow({ created_at: '2026-10-01T08:00:00Z', expires_at: '2026-10-15T08:00:00Z' }, now);
    expect(d?.toISOString()).toBe('2026-10-01T08:00:00.000Z');
  });
  it('falls back to expiry minus TTL when created_at is an old first insert', () => {
    const d = fetchedAtFromRow({ created_at: '2026-06-01T00:00:00Z', expires_at: '2026-10-10T00:00:00Z' }, now);
    expect(d?.toISOString()).toBe('2026-09-26T00:00:00.000Z');
  });
  it('returns null when neither signal is usable', () => {
    expect(fetchedAtFromRow({ created_at: null, expires_at: null }, now)).toBeNull();
  });
});
