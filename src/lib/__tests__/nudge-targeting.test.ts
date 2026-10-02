import { describe, it, expect } from 'vitest';
import { hasOptedOut, inNudgeWindow } from '../../../supabase/functions/send-claim-nudge/targeting';

describe('hasOptedOut', () => {
  it('lets users we never asked receive the single nudge', () => {
    expect(hasOptedOut(null)).toBe(false);
    expect(hasOptedOut({ digest_opt_in: false, marketing_opt_in: false, consent_source: null })).toBe(false);
  });
  it('respects an unsubscribe link and an explicit all-off choice', () => {
    expect(hasOptedOut({ digest_opt_in: true, marketing_opt_in: false, consent_source: 'unsubscribe-link' })).toBe(true);
    expect(hasOptedOut({ digest_opt_in: false, marketing_opt_in: false, consent_source: 'settings' })).toBe(true);
    expect(hasOptedOut({ digest_opt_in: false, marketing_opt_in: false, consent_source: 'signup' })).toBe(true);
  });
  it('keeps users who opted into something', () => {
    expect(hasOptedOut({ digest_opt_in: true, marketing_opt_in: false, consent_source: 'signup' })).toBe(false);
  });
});

describe('inNudgeWindow', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  it('waits three days', () => {
    expect(inNudgeWindow('2026-10-08T12:00:00Z', now)).toBe(false);
    expect(inNudgeWindow('2026-10-07T12:00:00Z', now)).toBe(true);
  });
  it('never reaches back past the window', () => {
    expect(inNudgeWindow('2026-09-20T12:00:00Z', now)).toBe(false);
    expect(inNudgeWindow('2026-09-20T12:00:00Z', now, 30)).toBe(true);
  });
  it('treats a missing date as out of window', () => {
    expect(inNudgeWindow('', now)).toBe(false);
  });
});
