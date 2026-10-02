import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { claimableIds, toClaimStatusMap } from '../claimed-profiles';

describe('claimableIds', () => {
  it('keeps Scholar ids and drops OpenAlex tokens and duplicates', () => {
    expect(claimableIds(['NOSPtp8AAAAJ', 'openalex:A5077827457', 'TwIgB-IAAAAJ', 'NOSPtp8AAAAJ']))
      .toEqual(['NOSPtp8AAAAJ', 'TwIgB-IAAAAJ']);
  });
});

describe('toClaimStatusMap', () => {
  it('maps verified rows to verified and the rest to claimed', () => {
    const map = toClaimStatusMap([
      { author_id: 'a', verified: true },
      { author_id: 'b', verified: false },
      { author_id: 'c', verified: null },
    ]);
    expect(map.get('a')).toBe('verified');
    expect(map.get('b')).toBe('claimed');
    expect(map.get('c')).toBe('claimed');
    expect(map.has('d')).toBe(false);
  });
});
