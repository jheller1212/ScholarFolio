import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomId } from '../randomId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns a v4 UUID', () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  // The reported failure: "crypto.randomUUID is not a function" on the ORCID
  // sign-in button, which left the visitor unable to start the claim flow.
  it('still returns a v4 UUID when crypto.randomUUID is missing', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const a = randomId();
    const b = randomId();
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});
