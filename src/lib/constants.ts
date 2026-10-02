export const ADMIN_EMAIL = 'jonasheller89@gmail.com';

// Lookup allowance — the single source of truth for every piece of UI copy.
// The server enforces the monthly number in the `monthly_lookup_allowance()`
// SQL function (supabase/migrations/20261002_monthly_lookup_allowance.sql);
// change both together.

/** Fresh profile lookups an anonymous visitor gets before the sign-up wall. */
export const ANON_FREE_LOOKUPS = 2;

/** Fresh lookups a signed-in user gets per calendar month (UTC). An abuse guard, not a product tier. */
export const MONTHLY_FREE_LOOKUPS = 20;

/** Days a fetched profile stays cached; cached views are free for signed-in users. */
export const PROFILE_CACHE_DAYS = 14;

export interface SupportPack {
  /** Must match a pack id in supabase/functions/create-checkout. */
  id: 'starter' | 'pro';
  priceEur: number;
  /** Extra lookups added as a thank-you; they never expire. */
  extraLookups: number;
}

export const SUPPORT_PACKS: readonly SupportPack[] = [
  { id: 'starter', priceEur: 5, extraLookups: 25 },
  { id: 'pro', priceEur: 10, extraLookups: 75 },
];
