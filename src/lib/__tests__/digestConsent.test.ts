import { describe, it, expect } from 'vitest';
import { digestStatus } from '../digestConsent';

describe('digestStatus (mirrors send-digest eligibility)', () => {
  const all = { optedIn: true, hasVerifiedClaim: true, hasDeliverableEmail: true };

  it('is on only with opt-in, a verified claim and a real email', () => {
    expect(digestStatus(all)).toBe('on');
  });

  it('is off without opt-in, whatever else holds', () => {
    expect(digestStatus({ ...all, optedIn: false })).toBe('off');
  });

  it('waits for a claim before anything else', () => {
    expect(digestStatus({ ...all, hasVerifiedClaim: false, hasDeliverableEmail: false })).toBe('needs-claim');
  });

  it('waits for a deliverable email after the claim', () => {
    expect(digestStatus({ ...all, hasDeliverableEmail: false })).toBe('needs-email');
  });
});
