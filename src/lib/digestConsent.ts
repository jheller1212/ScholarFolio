/**
 * The monthly citation digest, in the words the UI uses and the rule
 * supabase/functions/send-digest applies. Keep the two in step: the digest
 * goes only to users with digest_opt_in, a VERIFIED claimed profile and a
 * deliverable (non-placeholder) email, and only in months where the
 * profile's numbers changed. A promise the UI makes beyond that is a lie.
 */

/** Sign-up forms: consent is stored now but nothing is sent before a claim. */
export const DIGEST_SIGNUP_LABEL = 'Monthly citation updates for your profile — starts once you claim it.';

/** Settings and the claim success screen. */
export const DIGEST_DESCRIPTION = 'A monthly email with new citations on your claimed profile, sent in months when your numbers change.';

export type DigestStatus = 'off' | 'on' | 'needs-claim' | 'needs-email';

export interface DigestInputs {
  optedIn: boolean;
  hasVerifiedClaim: boolean;
  hasDeliverableEmail: boolean;
}

/** Mirror of send-digest's recipient filter. */
export function digestStatus({ optedIn, hasVerifiedClaim, hasDeliverableEmail }: DigestInputs): DigestStatus {
  if (!optedIn) return 'off';
  if (!hasVerifiedClaim) return 'needs-claim';
  if (!hasDeliverableEmail) return 'needs-email';
  return 'on';
}

export const DIGEST_STATUS_TEXT: Record<Exclude<DigestStatus, 'off'>, string> = {
  on: 'Your monthly updates are on.',
  'needs-claim': 'Your monthly updates start once you claim your profile.',
  'needs-email': 'Your monthly updates start once you add and confirm an email address.',
};
