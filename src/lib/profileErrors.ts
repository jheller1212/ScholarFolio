/**
 * Plain-language copy for a failed profile lookup. The raw message (often an
 * upstream/SerpAPI string) stays available behind a details toggle and in the
 * error log; visitors get something they can act on.
 */
export interface FriendlyProfileError {
  title: string;
  message: string;
}

export function friendlyProfileError(code: string | null | undefined): FriendlyProfileError {
  switch (code) {
    case 'RATE_LIMITED':
      return {
        title: 'Too many lookups at once',
        message: 'We had to pause lookups for a moment to keep the service fair for everyone. Give it a minute, then retry.',
      };
    case 'CREDITS_EXHAUSTED':
      return {
        title: "You've reached your lookup limit",
        message: 'This profile needs a fresh lookup and your allowance for now is used up. Profiles shared by direct link stay free to open.',
      };
    case 'NO_DATA':
      return {
        title: "We couldn't load this profile",
        message: 'The profile came back empty. It may be private, removed, or temporarily unavailable on Google Scholar.',
      };
    default:
      return {
        title: "We couldn't load this profile right now",
        message: 'Google Scholar did not respond in time. This is usually temporary: retry in a moment, or search by name to find the researcher (we fall back to open data from OpenAlex when Scholar is unavailable).',
      };
  }
}

/**
 * Best guess at a name to prefill the "search by name" box after a failure:
 * the known fallback name, else a vanity slug in the current path.
 */
export function nameQueryForFailedLookup(nameFallback: string | undefined, pathname: string): string {
  if (nameFallback?.trim()) return nameFallback.trim();
  const slug = pathname.replace(/^\//, '').replace(/\/$/, '');
  if (/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return slug.replace(/-/g, ' ');
  return '';
}
