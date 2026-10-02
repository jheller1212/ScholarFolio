import { describe, it, expect } from 'vitest';
import { nextAllowanceReset, formatResetDate, parseLookupAllowance, lookupsAvailable } from '../allowance';

describe('nextAllowanceReset', () => {
  it('returns the first of the next month in UTC', () => {
    expect(nextAllowanceReset(new Date('2026-10-02T12:00:00Z')).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('rolls over the year in December', () => {
    expect(nextAllowanceReset(new Date('2026-12-31T23:59:59Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('uses the UTC month, not the local one', () => {
    // 23:30 UTC on 31 Jan is already February in CET, but the server bucket is still January.
    expect(nextAllowanceReset(new Date('2026-01-31T23:30:00Z')).toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('formatResetDate', () => {
  it('formats as day and month', () => {
    expect(formatResetDate(new Date('2026-11-01T00:00:00Z'))).toBe('1 November');
  });
});

describe('parseLookupAllowance', () => {
  it('parses a valid payload', () => {
    const a = parseLookupAllowance({ monthly_allowance: 20, monthly_used: 3, monthly_remaining: 17, extra: 25, resets_on: '2026-11-01' });
    expect(a).not.toBeNull();
    expect(a?.monthlyRemaining).toBe(17);
    expect(a?.extra).toBe(25);
    expect(a?.resetsOn.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(a && lookupsAvailable(a)).toBe(42);
  });

  it('rejects missing or malformed payloads', () => {
    expect(parseLookupAllowance(null)).toBeNull();
    expect(parseLookupAllowance({ monthly_allowance: 20 })).toBeNull();
    expect(parseLookupAllowance({ monthly_allowance: 20, monthly_remaining: 1, extra: 0, resets_on: 'soon' })).toBeNull();
  });
});
