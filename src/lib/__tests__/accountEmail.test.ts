import { describe, it, expect } from 'vitest';
import { checkNewEmail, deliverableEmail, isPlaceholderEmail } from '../accountEmail';

describe('accountEmail', () => {
  it('spots ORCID placeholder logins', () => {
    expect(isPlaceholderEmail('0000000218250097@orcid.scholarfolio.org')).toBe(true);
    expect(isPlaceholderEmail('Someone@ORCID.ScholarFolio.org')).toBe(true);
    expect(isPlaceholderEmail('me@uni.edu')).toBe(false);
    expect(isPlaceholderEmail(undefined)).toBe(false);
  });

  it('never returns a placeholder as a usable address', () => {
    expect(deliverableEmail('1@orcid.scholarfolio.org')).toBeNull();
    expect(deliverableEmail('me@uni.edu')).toBe('me@uni.edu');
    expect(deliverableEmail(null)).toBeNull();
  });

  it('validates a new address', () => {
    expect(checkNewEmail('  Me@Uni.edu ')).toEqual({ ok: true, email: 'me@uni.edu' });
    expect(checkNewEmail('nope').ok).toBe(false);
    expect(checkNewEmail('1@orcid.scholarfolio.org').ok).toBe(false);
  });
});
