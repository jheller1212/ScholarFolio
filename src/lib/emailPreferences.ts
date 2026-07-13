import { supabase } from './supabase';
import { logCaughtError } from './errorLogger';

// Bump whenever the user-facing consent wording changes — the stored version
// is the GDPR Art. 7 record of exactly what the user agreed to.
export const CONSENT_WORDING_VERSION = 'v1-2026-07-13';

export interface EmailOptIns {
  digest_opt_in: boolean;
  marketing_opt_in: boolean;
}

export interface EmailPreferencesRow extends EmailOptIns {
  user_id: string;
  consented_at: string | null;
  consent_source: string | null;
}

// Consent given on a signup form before the account (and session) exists —
// e.g. email signups awaiting confirmation, or OAuth redirects. Parked in
// localStorage and flushed to the DB on the first authenticated load.
const PENDING_KEY = 'sf_pending_email_consent';
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Tolerance when checking that the signed-in account was actually created
// around the time the consent was parked (clock skew, confirm-email delay).
const ACCOUNT_AGE_TOLERANCE_MS = 10 * 60 * 1000;

interface PendingConsent extends Partial<EmailOptIns> {
  source: string;
  at: number;
  /** Signup email when known (email/password flow); used to verify ownership. */
  email?: string;
}

export function setPendingEmailConsent(
  optIns: Partial<EmailOptIns>,
  source: string,
  email?: string
): void {
  try {
    const pending: PendingConsent = { ...optIns, source, at: Date.now(), email };
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // localStorage unavailable — consent can still be given later in settings
  }
}

export function clearPendingEmailConsent(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

interface FlushUser {
  id: string;
  email?: string;
  created_at: string;
}

/**
 * Persist consent parked at signup. Guards against attaching it to the wrong
 * account (shared browsers): the pending record is discarded unless the
 * signed-in account was created no earlier than the consent was given, and —
 * when the signup email is known — the emails match.
 */
export async function flushPendingEmailConsent(user: FlushUser): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let pending: PendingConsent;
  try {
    pending = JSON.parse(raw) as PendingConsent;
  } catch {
    clearPendingEmailConsent();
    return;
  }

  const fresh = typeof pending.at === 'number' && Date.now() - pending.at < PENDING_MAX_AGE_MS;
  const hasOptIn = Boolean(pending.digest_opt_in || pending.marketing_opt_in);
  const emailMatches =
    !pending.email || !user.email || pending.email.toLowerCase() === user.email.toLowerCase();
  // Signup consent belongs to an account created at (or after) the moment the
  // form was submitted — an older account signing in on this browser is
  // someone else, and must not inherit the parked consent.
  const accountIsNew =
    new Date(user.created_at).getTime() >= pending.at - ACCOUNT_AGE_TOLERANCE_MS;

  if (!fresh || !hasOptIn || !emailMatches || !accountIsNew) {
    clearPendingEmailConsent();
    return;
  }

  const { error } = await saveEmailPreferences(user.id, pending, pending.source || 'signup');
  // Keep the record on transient failure — the next auth event retries,
  // bounded by the 24h staleness guard.
  if (!error) clearPendingEmailConsent();
}

export async function getEmailPreferences(userId: string): Promise<EmailPreferencesRow | null> {
  const { data, error } = await supabase
    .from('email_preferences')
    .select('user_id, digest_opt_in, marketing_opt_in, consented_at, consent_source')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logCaughtError(error, 'auth', 'emailPreferences', 'get-preferences');
    return null;
  }
  return data as EmailPreferencesRow | null;
}

/**
 * Persist opt-ins. Partial writes touch only the provided flags (a claim-time
 * digest opt-in never clears an earlier marketing consent, even when racing
 * the signup flush).
 */
export async function saveEmailPreferences(
  userId: string,
  optIns: Partial<EmailOptIns>,
  source: string
): Promise<{ error: string | null }> {
  const changes: Record<string, unknown> = {
    consented_at: new Date().toISOString(),
    consent_source: source,
    wording_version: CONSENT_WORDING_VERSION,
  };
  if (optIns.digest_opt_in !== undefined) changes.digest_opt_in = optIns.digest_opt_in;
  if (optIns.marketing_opt_in !== undefined) changes.marketing_opt_in = optIns.marketing_opt_in;

  const existing = await getEmailPreferences(userId);
  let error;
  if (existing) {
    ({ error } = await supabase.from('email_preferences').update(changes).eq('user_id', userId));
  } else {
    ({ error } = await supabase.from('email_preferences').insert({
      user_id: userId,
      digest_opt_in: optIns.digest_opt_in ?? false,
      marketing_opt_in: optIns.marketing_opt_in ?? false,
      ...changes,
    }));
    if (error?.code === '23505') {
      // Row appeared between read and insert (concurrent flush) — fall back
      // to the partial update so neither writer clears the other's flag.
      ({ error } = await supabase.from('email_preferences').update(changes).eq('user_id', userId));
    }
  }
  if (error) {
    logCaughtError(error, 'auth', 'emailPreferences', 'save-preferences', { source });
    return { error: error.message };
  }
  return { error: null };
}
