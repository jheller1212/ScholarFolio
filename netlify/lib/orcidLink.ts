import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Linking an ORCID iD to the account that is already signed in.
 *
 * Plain ORCID sign-in matches or creates an account and signs the browser in
 * as it, so a signed-in email user who "connects" ORCID used to be switched
 * into a fresh placeholder account. The link flow instead parks a short-lived,
 * single-use intent (orcid-link-start, JWT-verified) that the callback
 * consumes. Everything here is pure so the security rules are testable.
 */

export const LINK_INTENT_TTL_MS = 10 * 60 * 1000;
export const LINK_COOKIE = 'sf_orcid_link';
export const PLACEHOLDER_EMAIL_DOMAIN = '@orcid.scholarfolio.org';

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only hashes are stored, so a leaked table row can't be replayed. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** Server-issued states are 43-char base64url; client sign-in states are hex/uuid-like. */
export function looksLikeState(state: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(state);
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=') || null;
  }
  return null;
}

/** HttpOnly, path-scoped to /api so only the start and callback endpoints see it. */
export function linkCookie(value: string, maxAgeSeconds: number): string {
  return `${LINK_COOKIE}=${value}; Path=/api; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export interface StoredIntent {
  user_id: string;
  binding_hash: string;
  expires_at: string;
}

export type IntentCheck =
  | { ok: true; userId: string }
  | { ok: false; reason: 'link_expired' | 'link_invalid' };

/**
 * The state alone is not enough: it travels through ORCID and the URL bar. The
 * cookie set by orcid-link-start binds the intent to the browser that created
 * it, so an attacker can't send a victim through ORCID with the attacker's
 * state and get the victim's iD linked to the attacker's account.
 */
export function checkIntent(intent: StoredIntent, bindingCookie: string | null, now: number): IntentCheck {
  if (!bindingCookie || !safeEqualHex(sha256(bindingCookie), intent.binding_hash)) {
    return { ok: false, reason: 'link_invalid' };
  }
  if (new Date(intent.expires_at).getTime() <= now) return { ok: false, reason: 'link_expired' };
  return { ok: true, userId: intent.user_id };
}

export interface AccountSummary {
  id: string;
  email: string | null;
  /** app_metadata.orcid_id only: user_metadata is user-editable. */
  orcidId: string | null;
  hasClaim: boolean;
}

export type LinkDecision =
  | { action: 'already-linked' }
  | { action: 'link'; moveFrom: string[] }
  | { action: 'refuse'; reason: 'link_other_orcid' | 'link_claimed' | 'link_taken'; holderId?: string };

/**
 * Decide what linking `orcidId` to `target` means.
 * - Another account holding the iD that is only a placeholder login with no
 *   claimed profile is the split this flow exists to heal: move the iD.
 * - An account with a claimed profile, or a real email address, belongs to
 *   someone who may not be this user: refuse and let the admin decide.
 * - A target already linked to a different iD is refused rather than silently
 *   re-pointed, because claim verification hangs off that iD.
 */
export function decideLink(orcidId: string, target: AccountSummary, holders: AccountSummary[]): LinkDecision {
  if (target.orcidId && target.orcidId !== orcidId) return { action: 'refuse', reason: 'link_other_orcid' };

  const others = holders.filter((h) => h.id !== target.id && h.orcidId === orcidId);
  for (const h of others) {
    if (h.hasClaim) return { action: 'refuse', reason: 'link_claimed', holderId: h.id };
    if (!isPlaceholderEmail(h.email)) return { action: 'refuse', reason: 'link_taken', holderId: h.id };
  }

  if (target.orcidId === orcidId && others.length === 0) return { action: 'already-linked' };
  return { action: 'link', moveFrom: others.map((h) => h.id) };
}
