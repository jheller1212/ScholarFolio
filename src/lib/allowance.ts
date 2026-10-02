/**
 * First day of the next calendar month in UTC — when the monthly lookup
 * allowance resets. Mirrors the server, which buckets by UTC month.
 */
export function nextAllowanceReset(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** e.g. "1 November" — the year is implied (always within a month). */
export function formatResetDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** A signed-in user's lookup budget, as returned by the `get_lookup_allowance` RPC. */
export interface LookupAllowance {
  monthlyAllowance: number;
  monthlyRemaining: number;
  /** Extra lookups from support packs and thank-yous; spent after the monthly allowance. */
  extra: number;
  resetsOn: Date;
}

/** Validates the RPC payload; null if it is missing or malformed (e.g. before the migration). */
export function parseLookupAllowance(raw: unknown): LookupAllowance | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const { monthly_allowance, monthly_remaining, extra, resets_on } = r;
  if (typeof monthly_allowance !== 'number' || typeof monthly_remaining !== 'number' || typeof extra !== 'number' || typeof resets_on !== 'string') {
    return null;
  }
  const resetsOn = new Date(`${resets_on}T00:00:00Z`);
  if (Number.isNaN(resetsOn.getTime())) return null;
  return { monthlyAllowance: monthly_allowance, monthlyRemaining: monthly_remaining, extra, resetsOn };
}

/** Total fresh lookups available right now. */
export function lookupsAvailable(a: LookupAllowance): number {
  return a.monthlyRemaining + a.extra;
}
