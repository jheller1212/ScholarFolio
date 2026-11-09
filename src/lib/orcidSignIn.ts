import { randomId } from './randomId';

const ORCID_CLIENT_ID = 'APP-R9QF1AQWVYVJW0V9';

// App compares the state that comes back with this copy (CSRF protection).
const STATE_KEY = 'orcid_oauth_state';

function goToOrcid(state: string): void {
  sessionStorage.setItem(STATE_KEY, state);
  const redirectUri = encodeURIComponent(`${window.location.origin}/api/orcid-callback`);
  window.location.href = `https://orcid.org/oauth/authorize?client_id=${ORCID_CLIENT_ID}&response_type=code&scope=/authenticate&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}`;
}

/**
 * Leave for ORCID's OAuth screen to sign in. The netlify orcid-callback
 * function matches or creates an account and signs the browser in as it.
 * Only for signed-out visitors: a signed-in user must use startOrcidLink, or
 * they get switched into a separate ORCID account.
 */
export function startOrcidSignIn(): void {
  goToOrcid(randomId());
}

/**
 * Connect ORCID to the account that is signed in now. The server issues the
 * state (bound to this user and an HttpOnly cookie), so the callback links
 * the iD here and keeps the current session instead of signing in elsewhere.
 */
export async function startOrcidLink(accessToken: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/orcid-link-start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'same-origin',
    });
    const body: unknown = await res.json().catch(() => null);
    const state = body && typeof body === 'object' ? (body as { state?: unknown }).state : undefined;
    if (!res.ok || typeof state !== 'string') {
      return { error: 'Could not start connecting your ORCID iD. Please try again.' };
    }
    goToOrcid(state);
    return { error: null };
  } catch {
    return { error: 'Could not reach the server. Please try again.' };
  }
}
