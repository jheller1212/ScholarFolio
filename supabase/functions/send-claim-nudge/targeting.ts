/**
 * Who gets a lifecycle nudge. Dependency-free so src/ vitest can cover it.
 *
 * Two one-time emails, each sent once per account and only inside a short
 * window so a backlog of old accounts is never mass-mailed:
 *  - claim_reminder: signed up 3+ days ago and never claimed a profile.
 *  - finish_profile: claimed (ORCID-verified) 3+ days ago — pronouns, hiding
 *    wrong papers, badge, digest opt-in.
 */

export const NUDGE_DELAY_DAYS = 3;
export const NUDGE_WINDOW_DAYS = 14;

const DAY_MS = 86_400_000;

export interface Prefs {
  digest_opt_in: boolean;
  marketing_opt_in: boolean;
  consent_source: string | null;
}

/**
 * True when the user has said no to our email: they used an unsubscribe link,
 * or made an explicit choice (signup form, settings) that left every opt-in
 * off. Users we never asked have no recorded choice and get the single nudge,
 * which carries an unsubscribe link of its own.
 */
export function hasOptedOut(prefs: Prefs | null | undefined): boolean {
  if (!prefs) return false;
  if (prefs.consent_source === 'unsubscribe-link') return true;
  return !prefs.digest_opt_in && !prefs.marketing_opt_in && prefs.consent_source !== null;
}

/** `since` is between NUDGE_DELAY_DAYS and `windowDays` ago. */
export function inNudgeWindow(since: string, now: Date, windowDays = NUDGE_WINDOW_DAYS): boolean {
  const age = now.getTime() - new Date(since).getTime();
  return age >= NUDGE_DELAY_DAYS * DAY_MS && age <= windowDays * DAY_MS;
}
