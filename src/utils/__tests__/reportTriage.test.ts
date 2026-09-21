import { daysWaiting, triageOrder } from '../reportTriage';

const report = (id: string, created_at: string, resolved: boolean) => ({ id, created_at, resolved });

describe('report triage', () => {
  it('puts the longest-waiting open report first and resolved ones last', () => {
    const ordered = triageOrder([
      report('resolved-new', '2026-09-01T00:00:00Z', true),
      report('open-new', '2026-08-03T00:00:00Z', false),
      report('resolved-old', '2026-07-01T00:00:00Z', true),
      report('open-old', '2026-07-23T00:00:00Z', false),
    ]);
    expect(ordered.map(r => r.id)).toEqual(['open-old', 'open-new', 'resolved-new', 'resolved-old']);
  });

  it('counts whole days waiting', () => {
    const now = new Date('2026-09-21T12:00:00Z');
    expect(daysWaiting(report('a', '2026-08-03T00:06:50Z', false), now)).toBe(49);
    expect(daysWaiting(report('b', '2026-09-21T09:00:00Z', false), now)).toBe(0);
  });
});
