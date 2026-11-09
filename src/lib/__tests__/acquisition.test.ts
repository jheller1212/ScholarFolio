import { classifyPageType, referrerHost, landingsFrom, funnelCounts, type AnalyticsRow } from '../acquisition';

describe('classifyPageType', () => {
  test.each([
    ['/', 'home'],
    ['/?utm_source=x', 'home'],
    ['/?user=abcdEFGH1234', 'profile'],
    ['/scholar/abcdEFGH1234', 'profile'],
    ['/scholar/openalex:A123/', 'profile'],
    ['/jonas-heller', 'vanity'],
    ['/jonas-heller/', 'vanity'],
    ['/guides/', 'guide'],
    ['/guides/erc-cv-track-record/', 'guide'],
    ['/institutions', 'institutions'],
    ['/?page=institutions', 'institutions'],
    ['/trending', 'trending'],
    ['/privacy', 'other'],
    ['/?page=admin', 'other'],
    ['/a', 'other'],
    ['/some/deep/path', 'other'],
  ])('%s -> %s', (path, expected) => {
    expect(classifyPageType(path)).toBe(expected);
  });
});

describe('referrerHost', () => {
  test('normalises hosts and buckets direct/internal', () => {
    expect(referrerHost(null)).toBe('direct');
    expect(referrerHost('direct')).toBe('direct');
    expect(referrerHost('https://www.google.com/search?q=x')).toBe('google.com');
    expect(referrerHost('https://scholarfolio.org/guides/')).toBe('internal');
    expect(referrerHost('not a url')).toBe('unknown');
  });
});

const row = (over: Partial<AnalyticsRow>): AnalyticsRow => ({
  event: 'visit', pathname: '/', properties: {}, referrer: null, session_id: 's1', created_at: '2026-11-01T10:00:00Z', ...over,
});

describe('landingsFrom / funnelCounts', () => {
  test('takes the earliest landing per session, guide before app', () => {
    const rows = [
      row({ session_id: 's1', created_at: '2026-11-01T10:05:00Z', properties: { landing_page: '/?utm_source=guide', utm_source: 'guide' } }),
      row({ event: 'page_view', session_id: 's1', created_at: '2026-11-01T10:00:00Z', properties: { landing: true, page_type: 'guide', path: '/guides/x/', referrer: 'https://www.google.com/' } }),
      row({ session_id: 's2', properties: { landing_page: '/jonas-heller', referrer: 'https://t.co/abc' } }),
      row({ event: 'page_view', session_id: 's3', properties: { landing: false, page_type: 'home' } }),
    ];
    const landings = landingsFrom(rows);
    expect(landings).toHaveLength(2);
    const s1 = landings.find(l => l.sessionId === 's1');
    expect(s1).toMatchObject({ pageType: 'guide', referrerHost: 'google.com', utmSource: '(none)' });
    expect(landings.find(l => l.sessionId === 's2')).toMatchObject({ pageType: 'vanity', referrerHost: 't.co' });
  });

  test('counts distinct sessions per step', () => {
    const rows = [
      row({ session_id: 's1' }),
      row({ session_id: 's2' }),
      row({ event: 'search', session_id: 's1' }),
      row({ event: 'search', session_id: 's1' }),
      row({ event: 'profile_view', session_id: 's2' }),
    ];
    const counts = Object.fromEntries(funnelCounts(rows, landingsFrom(rows)).map(c => [c.step, c.sessions]));
    expect(counts).toEqual({ visit: 2, search: 1, profile_view: 1, signup: 0, claim_started: 0, claim_completed: 0 });
  });
});
