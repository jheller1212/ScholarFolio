/**
 * Adding a real address to an ORCID-only account, whose login address
 * (<digits>@orcid.scholarfolio.org) has no mailbox.
 *
 * Supabase's "secure email change" stays ON for everyone: it makes a change
 * confirm from both the old and the new address. A placeholder account can
 * never confirm from its old address, so for those accounts only the server
 * vouches for the old side (the caller proved they own the account with
 * their JWT) and the new address still has to click its own link.
 * Pure helpers here; IO lives in the placeholder-email-change function.
 */

export const PLACEHOLDER_EMAIL_DOMAIN = '@orcid.scholarfolio.org';

/** At most one link a minute and five a day per account. */
export const MIN_INTERVAL_MS = 60 * 1000;
export const MAX_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Our side of a pending change; Supabase's own link expiry may be shorter. */
export const PENDING_TTL_MS = DAY_MS;

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

export type NewEmailCheck = { ok: true; email: string } | { ok: false; error: string };

export function checkNewEmail(value: unknown): NewEmailCheck {
  if (typeof value !== 'string') return { ok: false, error: 'invalid_email' };
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'invalid_email' };
  if (isPlaceholderEmail(email)) return { ok: false, error: 'invalid_email' };
  return { ok: true, email };
}

export type RateCheck = { ok: true; history: number[] } | { ok: false; retryAfterSeconds: number };

/**
 * `history` is the request timestamps kept in app_metadata (only the service
 * role can write it). Returns the trimmed history including `now` to store.
 */
export function checkRate(history: unknown, now: number): RateCheck {
  const recent = (Array.isArray(history) ? history : [])
    .filter((t): t is number => typeof t === 'number' && now - t < DAY_MS && t <= now)
    .sort((a, b) => a - b);
  const last = recent[recent.length - 1];
  if (last !== undefined && now - last < MIN_INTERVAL_MS) {
    return { ok: false, retryAfterSeconds: Math.ceil((MIN_INTERVAL_MS - (now - last)) / 1000) };
  }
  if (recent.length >= MAX_PER_DAY) {
    return { ok: false, retryAfterSeconds: Math.ceil((recent[0] + DAY_MS - now) / 1000) };
  }
  return { ok: true, history: [...recent, now] };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function confirmationEmail(link: string): { subject: string; html: string; text: string } {
  const subject = 'Confirm your email address for ScholarFolio';
  const text = `Hi,

Someone (hopefully you) signed in to ScholarFolio with ORCID and asked us to send updates to this address.

Confirm it here: ${link}

Until you click the link, nothing changes and we won't email this address again. If this wasn't you, ignore this email.

ScholarFolio · https://scholarfolio.org`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#1e293b;max-width:520px">
  <p>Hi,</p>
  <p>Someone (hopefully you) signed in to ScholarFolio with ORCID and asked us to send updates to this address.</p>
  <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#2d7d7d;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Confirm this address</a></p>
  <p style="font-size:13px;color:#64748b">Until you click the link, nothing changes and we won't email this address again. If this wasn't you, ignore this email.</p>
  <p style="font-size:13px;color:#64748b">ScholarFolio · <a href="https://scholarfolio.org" style="color:#2d7d7d">scholarfolio.org</a></p>
</div>`;
  return { subject, html, text };
}
