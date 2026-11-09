import { referrerHost } from './acquisition';

/**
 * How a visitor reached a profile, for the profile_view event. Links we hand
 * out carry a `ref` marker (?ref=share, ?ref=badge, ...) so the entry can be
 * told apart from a plain direct visit; nothing personal is encoded.
 */

export const REF_VALUES = ['share', 'badge', 'coauthor', 'trending'] as const;
export type RefValue = (typeof REF_VALUES)[number];

export type ProfileEntry =
  | 'search' | RefValue | 'email' | 'guide' | 'campaign' | 'referral' | 'direct';

export interface EntryInput {
  /** The profile was opened from the in-app search (not a link). */
  userInitiated: boolean;
  ref: string | null;
  utmSource: string | null;
  /** Referrer host as returned by referrerHost() in lib/acquisition. */
  referrerHost: string;
}

export function deriveEntry({ userInitiated, ref, utmSource, referrerHost }: EntryInput): ProfileEntry {
  // A search typed in this tab wins over whatever link the tab was opened from.
  if (userInitiated) return 'search';
  if (ref && (REF_VALUES as readonly string[]).includes(ref)) return ref as RefValue;
  if (utmSource === 'email') return 'email';
  if (utmSource === 'guide') return 'guide';
  if (utmSource) return 'campaign';
  if (referrerHost !== 'direct' && referrerHost !== 'internal' && referrerHost !== 'unknown') return 'referral';
  return 'direct';
}

/** Add (or replace) the ?ref= marker on an absolute or root-relative URL. */
export function withRef(url: string, ref: RefValue): string {
  const [beforeHash, hash = ''] = url.split('#');
  const [path, query = ''] = beforeHash.split('?');
  const params = new URLSearchParams(query);
  params.set('ref', ref);
  return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

// The entry for the profile currently being loaded. Set by App when a load
// starts (it alone knows whether the user searched or followed a link) and
// read once by the profile page when it logs the view.
let pendingEntry: ProfileEntry | null = null;

export function setPendingProfileEntry(entry: ProfileEntry): void {
  pendingEntry = entry;
}

/**
 * Record the entry for the profile about to load, from the current URL. The
 * ref marker is then dropped from the address bar so a URL re-copied from
 * there doesn't keep claiming "share" (ProfileActions re-adds it on share).
 */
export function captureProfileEntry(userInitiated: boolean): void {
  const params = new URLSearchParams(window.location.search);
  setPendingProfileEntry(deriveEntry({
    userInitiated,
    ref: params.get('ref'),
    utmSource: params.get('utm_source'),
    referrerHost: referrerHost(document.referrer),
  }));
  if (params.has('ref')) {
    params.delete('ref');
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }
}

export function takePendingProfileEntry(): ProfileEntry {
  const entry = pendingEntry ?? 'direct';
  pendingEntry = null;
  return entry;
}
