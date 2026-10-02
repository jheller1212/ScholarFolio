/**
 * What a visitor was trying to do when an auth wall interrupted them.
 *
 * Kept in localStorage (not React state) because the auth round-trip often
 * leaves the page: Google OAuth redirects to the site root and the email
 * confirmation link opens a fresh tab. Without this, a new account lands on
 * an empty landing page instead of the profile they asked for.
 */
export interface PendingAuthIntent {
  /** The lookup to re-run: a Scholar URL or an "openalex:" token. */
  url: string;
  /** Name to fall back to OpenAlex with if Scholar is unreachable. */
  nameFallback?: string;
  /** Open the claim flow once the profile is back on screen. */
  claim?: boolean;
  savedAt: number;
}

const STORAGE_KEY = 'sf_pending_auth_intent';
// Long enough for an email confirmation that sits in the inbox for a while,
// short enough that a forgotten intent never hijacks a much later sign-in.
const TTL_MS = 24 * 60 * 60 * 1000;

export function savePendingAuthIntent(intent: Omit<PendingAuthIntent, 'savedAt'>, now = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...intent, savedAt: now }));
  } catch {
    // Storage blocked (private mode): resuming is a convenience, not a requirement.
  }
}

export function readPendingAuthIntent(now = Date.now()): PendingAuthIntent | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { url, nameFallback, claim, savedAt } = parsed as Record<string, unknown>;
    if (typeof url !== 'string' || !url || typeof savedAt !== 'number') return null;
    if (now - savedAt > TTL_MS || savedAt > now + 60_000) return null;
    return {
      url,
      savedAt,
      ...(typeof nameFallback === 'string' && nameFallback ? { nameFallback } : {}),
      ...(claim === true ? { claim: true } : {}),
    };
  } catch {
    return null;
  }
}

export function clearPendingAuthIntent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was saved either.
  }
}

/** Read and clear in one step so an intent is acted on at most once. */
export function takePendingAuthIntent(now = Date.now()): PendingAuthIntent | null {
  const intent = readPendingAuthIntent(now);
  clearPendingAuthIntent();
  return intent;
}
