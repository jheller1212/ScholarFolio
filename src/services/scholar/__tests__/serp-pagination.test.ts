import {
  hasMoreArticles,
  isLikelyTruncated,
  SERP_PAGE_SIZE,
  isAcceptableRefresh, } from '../../../../supabase/functions/scholar/pagination.ts';

const articles = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `P${i}` }));

describe('hasMoreArticles', () => {
  it('stops after a short page (the common <100-article profile costs one call)', () => {
    expect(hasMoreArticles({ articles: articles(28) })).toBe(false);
    expect(hasMoreArticles({ articles: [] })).toBe(false);
    expect(hasMoreArticles({})).toBe(false);
  });

  it('continues after a full page with a next link', () => {
    expect(hasMoreArticles({ articles: articles(SERP_PAGE_SIZE), serpapi_pagination: { next: 'https://serpapi.com/...' } })).toBe(true);
  });

  it('stops after a full page without a next link', () => {
    expect(hasMoreArticles({ articles: articles(SERP_PAGE_SIZE), serpapi_pagination: {} })).toBe(false);
  });

  it('falls back to the count rule when the pagination block is missing', () => {
    expect(hasMoreArticles({ articles: articles(SERP_PAGE_SIZE) })).toBe(true);
  });
});

describe('isLikelyTruncated', () => {
  it('trusts the completeness flag, even at exactly 100 publications', () => {
    expect(isLikelyTruncated({ publications: articles(100), _publicationsComplete: true })).toBe(false);
  });

  it('keeps the legacy exactly-100 heuristic for unflagged rows', () => {
    expect(isLikelyTruncated({ publications: articles(100) })).toBe(true);
    expect(isLikelyTruncated({ publications: articles(99) })).toBe(false);
    expect(isLikelyTruncated({ publications: articles(250) })).toBe(false);
    expect(isLikelyTruncated({})).toBe(false);
  });
});

describe('isAcceptableRefresh', () => {
  const graph = { metrics: { citationsPerYear: { 2025: 10 } } };
  const pubs = (n: number) => Array.from({ length: n }, () => ({}));
  const current = { publications: pubs(300) };

  it('accepts a complete SerpAPI result, even with fewer publications', () => {
    expect(isAcceptableRefresh({ _source: 'serpapi', _publicationsComplete: true, publications: pubs(290), ...graph }, current)).toBe(true);
  });

  it('rejects the scraper fallback, which caps at one page', () => {
    expect(isAcceptableRefresh({ _source: 'scraper', publications: pubs(100), ...graph }, current)).toBe(false);
  });

  it('rejects a run that stopped mid-pagination and lost publications', () => {
    expect(isAcceptableRefresh({ _source: 'serpapi', _publicationsComplete: false, publications: pubs(100), ...graph }, current)).toBe(false);
  });

  it('rejects an empty result even when marked complete', () => {
    expect(isAcceptableRefresh({ _source: 'serpapi', _publicationsComplete: true, publications: [], ...graph }, current)).toBe(false);
  });

  it('rejects a result without a citation graph', () => {
    expect(isAcceptableRefresh({ _source: 'serpapi', _publicationsComplete: true, publications: pubs(300), metrics: {} }, current)).toBe(false);
  });
});
