import { describe, it, expect } from 'vitest';
import { buildInviteMessage } from '../coAuthorInvite';

describe('buildInviteMessage', () => {
  it('links straight to the co-author profile when known', () => {
    const msg = buildInviteMessage({
      coAuthorName: 'Ada Lovelace',
      ownerName: 'Jonas Heller',
      sharedPapers: 3,
      profileLink: 'https://scholarfolio.org/scholar/abc123def456',
      siteUrl: 'https://scholarfolio.org',
    });
    expect(msg.startsWith('Hi Ada,')).toBe(true);
    expect(msg).toContain('(we have 3 papers together)');
    expect(msg).toContain('https://scholarfolio.org/scholar/abc123def456');
    expect(msg.trim().endsWith('Jonas Heller')).toBe(true);
  });

  it('falls back to the site when the profile id is unknown', () => {
    const msg = buildInviteMessage({
      coAuthorName: 'Ada Lovelace',
      ownerName: 'Jonas',
      sharedPapers: 1,
      profileLink: null,
      siteUrl: 'https://scholarfolio.org',
    });
    expect(msg).toContain('(we have 1 paper together)');
    expect(msg).toContain('searching your name at https://scholarfolio.org');
  });
});
