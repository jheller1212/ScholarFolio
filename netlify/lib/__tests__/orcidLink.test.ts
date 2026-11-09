import { describe, it, expect } from 'vitest';
import {
  checkIntent, decideLink, isPlaceholderEmail, linkCookie, looksLikeState, randomToken, readCookie, sha256,
  type AccountSummary,
} from '../orcidLink.ts';

const ORCID = '0000-0002-1825-0097';
const acct = (over: Partial<AccountSummary> & { id: string }): AccountSummary => ({
  email: `${over.id}@uni.edu`, orcidId: null, hasClaim: false, ...over,
});

describe('decideLink', () => {
  const target = acct({ id: 'me' });

  it('links a free iD to the signed-in account', () => {
    expect(decideLink(ORCID, target, [])).toEqual({ action: 'link', moveFrom: [] });
  });

  it('is a no-op when the account already holds the iD', () => {
    expect(decideLink(ORCID, { ...target, orcidId: ORCID }, [{ ...target, orcidId: ORCID }]))
      .toEqual({ action: 'already-linked' });
  });

  it('refuses when the account is linked to a different iD', () => {
    expect(decideLink(ORCID, { ...target, orcidId: '0000-0001-0000-0000' }, []))
      .toEqual({ action: 'refuse', reason: 'link_other_orcid' });
  });

  it('moves the iD off an unclaimed placeholder account', () => {
    const placeholder = acct({ id: 'ph', email: '0000000218250097@orcid.scholarfolio.org', orcidId: ORCID });
    expect(decideLink(ORCID, target, [placeholder])).toEqual({ action: 'link', moveFrom: ['ph'] });
  });

  it('refuses when the holder has a claimed profile, even a placeholder one', () => {
    const placeholder = acct({ id: 'ph', email: 'x@orcid.scholarfolio.org', orcidId: ORCID, hasClaim: true });
    expect(decideLink(ORCID, target, [placeholder]))
      .toEqual({ action: 'refuse', reason: 'link_claimed', holderId: 'ph' });
  });

  it('refuses when the holder is a real email account', () => {
    const other = acct({ id: 'other', orcidId: ORCID });
    expect(decideLink(ORCID, target, [other]))
      .toEqual({ action: 'refuse', reason: 'link_taken', holderId: 'other' });
  });

  it('ignores accounts holding a different iD', () => {
    expect(decideLink(ORCID, target, [acct({ id: 'x', orcidId: '0000-0001-0000-0000', hasClaim: true })]))
      .toEqual({ action: 'link', moveFrom: [] });
  });
});

describe('checkIntent', () => {
  const binding = randomToken();
  const now = Date.parse('2026-11-09T12:00:00Z');
  const intent = { user_id: 'me', binding_hash: sha256(binding), expires_at: '2026-11-09T12:05:00Z' };

  it('accepts the browser that started the link before expiry', () => {
    expect(checkIntent(intent, binding, now)).toEqual({ ok: true, userId: 'me' });
  });

  it('rejects another browser (no cookie or a different one)', () => {
    expect(checkIntent(intent, null, now)).toEqual({ ok: false, reason: 'link_invalid' });
    expect(checkIntent(intent, randomToken(), now)).toEqual({ ok: false, reason: 'link_invalid' });
  });

  it('rejects an expired intent', () => {
    expect(checkIntent(intent, binding, Date.parse('2026-11-09T12:05:00Z')))
      .toEqual({ ok: false, reason: 'link_expired' });
  });
});

describe('helpers', () => {
  it('recognises placeholder addresses only', () => {
    expect(isPlaceholderEmail('123@ORCID.scholarfolio.org')).toBe(true);
    expect(isPlaceholderEmail('me@scholarfolio.org')).toBe(false);
    expect(isPlaceholderEmail(null)).toBe(false);
  });

  it('accepts generated states and rejects junk', () => {
    expect(looksLikeState(randomToken())).toBe(true);
    expect(looksLikeState("x' or 1=1")).toBe(false);
    expect(looksLikeState('short')).toBe(false);
  });

  it('reads the binding cookie among others', () => {
    expect(readCookie('a=1; sf_orcid_link=abc; b=2', 'sf_orcid_link')).toBe('abc');
    expect(readCookie(undefined, 'sf_orcid_link')).toBeNull();
  });

  it('scopes the cookie to the api and keeps it from scripts', () => {
    expect(linkCookie('v', 600)).toMatch(/Path=\/api; Max-Age=600; HttpOnly; Secure; SameSite=Lax/);
  });
});
