import { describe, it, expect } from 'vitest';
import { MAX_PER_DAY, checkNewEmail, checkRate, confirmationEmail, isPlaceholderEmail } from '../placeholderEmail.ts';

describe('placeholder email change', () => {
  it('only treats ORCID placeholder logins as placeholders', () => {
    expect(isPlaceholderEmail('0000000218250097@orcid.scholarfolio.org')).toBe(true);
    expect(isPlaceholderEmail('me@uni.edu')).toBe(false);
    expect(isPlaceholderEmail(undefined)).toBe(false);
  });

  it('normalises a valid new address and rejects junk or placeholders', () => {
    expect(checkNewEmail('  Me@Uni.EDU ')).toEqual({ ok: true, email: 'me@uni.edu' });
    expect(checkNewEmail('nope').ok).toBe(false);
    expect(checkNewEmail(42).ok).toBe(false);
    expect(checkNewEmail('1@orcid.scholarfolio.org').ok).toBe(false);
  });

  const now = Date.parse('2026-11-09T12:00:00Z');

  it('allows a first request and records it', () => {
    expect(checkRate(undefined, now)).toEqual({ ok: true, history: [now] });
  });

  it('blocks a second request within a minute', () => {
    expect(checkRate([now - 30_000], now)).toEqual({ ok: false, retryAfterSeconds: 30 });
  });

  it('caps requests per day and forgets ones older than a day', () => {
    const full = Array.from({ length: MAX_PER_DAY }, (_, i) => now - (i + 1) * 3_600_000);
    expect(checkRate(full, now).ok).toBe(false);
    const old = full.map((t) => t - 86_400_000);
    expect(checkRate(old, now)).toEqual({ ok: true, history: [now] });
  });

  it('ignores garbage in the stored history', () => {
    expect(checkRate(['x', null, now + 999_999], now)).toEqual({ ok: true, history: [now] });
  });

  it('escapes the link in the html body', () => {
    const { html, text } = confirmationEmail('https://x.test/?a=1&b="2"');
    expect(html).toContain('a=1&amp;b=&quot;2&quot;');
    expect(text).toContain('https://x.test/?a=1&b="2"');
  });
});
