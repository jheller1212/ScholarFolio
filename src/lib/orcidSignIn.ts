import { randomId } from './randomId';

const ORCID_CLIENT_ID = 'APP-R9QF1AQWVYVJW0V9';

/**
 * Leave for ORCID's OAuth screen. The netlify orcid-callback function signs
 * the user in and returns them to the site root; the state round-trips
 * through sessionStorage so App can reject a forged callback.
 */
export function startOrcidSignIn(): void {
  const state = randomId();
  sessionStorage.setItem('orcid_oauth_state', state);
  const redirectUri = encodeURIComponent(`${window.location.origin}/api/orcid-callback`);
  window.location.href = `https://orcid.org/oauth/authorize?client_id=${ORCID_CLIENT_ID}&response_type=code&scope=/authenticate&redirect_uri=${redirectUri}&state=${state}`;
}
