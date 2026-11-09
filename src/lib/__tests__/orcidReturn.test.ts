import { describe, it, expect } from 'vitest';
import { readOrcidReturn } from '../orcidReturn';

const q = (s: string) => new URLSearchParams(s);

describe('readOrcidReturn', () => {
  it('confirms a link whose state matches this tab', () => {
    const r = readOrcidReturn(q('orcid_state=abc&orcid_linked=1'), 'abc');
    expect(r.linked).toBe(true);
    expect(r.stateMismatch).toBe(false);
    expect(r.notice?.tone).toBe('success');
    expect(r.consumedParams).toEqual(['orcid_state', 'orcid_linked']);
  });

  it('flags a state this tab never sent and claims nothing', () => {
    const r = readOrcidReturn(q('orcid_state=abc&orcid_linked=1'), null);
    expect(r.stateMismatch).toBe(true);
    expect(r.linked).toBe(false);
    expect(r.notice).toBeNull();
  });

  it('explains link refusals', () => {
    const r = readOrcidReturn(q('orcid_error=link_claimed'), 'abc');
    expect(r.notice?.tone).toBe('error');
    expect(r.notice?.text).toMatch(/claimed profile/);
  });

  it('stays silent for plain sign-in errors and plain sign-ins', () => {
    expect(readOrcidReturn(q('orcid_error=access_denied'), null).notice).toBeNull();
    expect(readOrcidReturn(q('orcid_state=abc'), 'abc')).toMatchObject({ notice: null, stateMismatch: false, linked: false });
  });
});
