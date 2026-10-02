import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

import { parseOpenAlexAuthorId } from '../MergeRecordPanel';

describe('parseOpenAlexAuthorId', () => {
  it('accepts a bare id, a site link and an API link', () => {
    expect(parseOpenAlexAuthorId('A5012345678')).toBe('A5012345678');
    expect(parseOpenAlexAuthorId('https://openalex.org/A5012345678')).toBe('A5012345678');
    expect(parseOpenAlexAuthorId(' https://api.openalex.org/authors/a5012345678?x=1 ')).toBe('A5012345678');
  });
  it('rejects work ids and junk', () => {
    expect(parseOpenAlexAuthorId('https://openalex.org/W123456789')).toBeNull();
    expect(parseOpenAlexAuthorId('Elizabeth Beekman')).toBeNull();
  });
});
