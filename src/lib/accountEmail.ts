/**
 * ORCID-only accounts log in with a placeholder address
 * (<orcid-digits>@orcid.scholarfolio.org) that has no mailbox. The mailer
 * refuses it (supabase/functions/_shared/mailer.ts), so such an account gets
 * no email at all until the owner adds a real address.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = '@orcid.scholarfolio.org';

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

/** The account's address if we can actually write to it, else null. */
export function deliverableEmail(email: string | null | undefined): string | null {
  return email && !isPlaceholderEmail(email) ? email : null;
}

/** Light check before handing the address to Supabase, which validates it properly. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type NewEmailCheck = { ok: true; email: string } | { ok: false; error: string };

export function checkNewEmail(value: string): NewEmailCheck {
  const email = value.trim().toLowerCase();
  if (!looksLikeEmail(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (isPlaceholderEmail(email)) return { ok: false, error: 'Please use an address you can receive mail at.' };
  return { ok: true, email };
}
