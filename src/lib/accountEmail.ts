import { supabase } from './supabase';
import { logError } from './errorLogger';

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

const CHANGE_ERRORS: Record<string, string> = {
  email_taken: 'That address already belongs to another ScholarFolio account. Email info@scholarfolio.org and we will merge them.',
  invalid_email: 'Please enter a valid email address.',
  rate_limited: 'We just sent a link. Please wait a little before asking for another.',
  not_placeholder: 'Your account already has an email address.',
  sign_in: 'Please sign in again and retry.',
};

export function changeErrorMessage(code: unknown): string {
  return (typeof code === 'string' && CHANGE_ERRORS[code]) || 'Could not send the confirmation email. Please try again.';
}

/** Server route for placeholder accounts only; see netlify/functions/placeholder-email-change. */
export async function requestPlaceholderEmailChange(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, message: changeErrorMessage('sign_in') };
    const res = await fetch('/api/placeholder-email-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email }),
    });
    if (res.ok) return { ok: true };
    const body: unknown = await res.json().catch(() => null);
    const code = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
    if (res.status >= 500) logError({ category: 'auth', message: `Placeholder email change failed: ${String(code)}`, component: 'accountEmail', action: 'request-email-change', context: { status: res.status } });
    return { ok: false, message: changeErrorMessage(code) };
  } catch {
    return { ok: false, message: 'Could not reach the server. Please try again.' };
  }
}
