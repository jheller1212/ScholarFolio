/**
 * What the ORCID callback reported when it sent the browser back. The
 * callback speaks in query params (orcid_state, orcid_linked, orcid_error);
 * this turns them into something the visitor can read, and says whether the
 * returned state proves the round-trip started in this tab.
 */

export interface OrcidNotice {
  tone: 'success' | 'error';
  text: string;
}

export interface OrcidReturn {
  notice: OrcidNotice | null;
  /** State came back but doesn't match what this tab sent: possible forgery. */
  stateMismatch: boolean;
  /** The iD was linked server-side; the session's copy of the user is stale. */
  linked: boolean;
  /** Params to strip from the address bar. */
  consumedParams: string[];
}

const ERROR_TEXT: Record<string, string> = {
  link_claimed:
    'This ORCID iD belongs to another ScholarFolio account with a claimed profile, so we did not move it. We have flagged it for review; email info@scholarfolio.org if you need it sorted sooner.',
  link_taken:
    'This ORCID iD is already connected to another ScholarFolio account. We have flagged it for review; email info@scholarfolio.org to have it moved.',
  link_other_orcid:
    'Your account is already connected to a different ORCID iD. Email info@scholarfolio.org if it needs changing.',
  link_expired: 'Connecting ORCID took longer than 10 minutes. Please try again.',
  link_invalid: 'We could not confirm that this ORCID connection started in this browser. Please try again.',
  link_failed: 'Something went wrong while connecting your ORCID iD. Please try again.',
};

export function readOrcidReturn(params: URLSearchParams, storedState: string | null): OrcidReturn {
  const error = params.get('orcid_error');
  const state = params.get('orcid_state');
  const linked = params.get('orcid_linked') === '1';
  const stateMismatch = state !== null && (!storedState || storedState !== state);

  let notice: OrcidNotice | null = null;
  if (error) {
    // Sign-in errors were always silent; only the link flow explains itself.
    if (ERROR_TEXT[error]) notice = { tone: 'error', text: ERROR_TEXT[error] };
  } else if (linked && !stateMismatch) {
    notice = { tone: 'success', text: 'Your ORCID iD is now connected to this account.' };
  }

  return {
    notice,
    stateMismatch,
    linked: linked && !stateMismatch,
    consumedParams: ['orcid_error', 'orcid_state', 'orcid_linked'].filter((k) => params.has(k)),
  };
}
