// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '@netlify/edge-functions';

const db = vi.hoisted(() => ({
  claims: new Map<string, { authorId: string; slug: string; displayName: string | null }>(),
  data: new Map<string, { name: string }>(),
  down: false,
}));

vi.mock('../supabase.ts', () => {
  const guard = <T>(v: T): Promise<T> => (db.down ? Promise.reject(new Error('down')) : Promise.resolve(v));
  return {
    fetchClaimBySlug: (slug: string) => guard(db.claims.get(slug) ?? null),
    fetchClaimByAuthor: (id: string) => guard([...db.claims.values()].find((c) => c.authorId === id) ?? null),
    fetchScholarData: (id: string) => guard(db.data.get(id) ?? null),
    fetchProfileIndex: () => Promise.resolve([]),
    fetchAuthorStrings: () => Promise.resolve([]),
    logAgentFetch: () => Promise.resolve(),
  };
});

const { default: handler } = await import('../og-meta.ts');

const SHELL = '<html><head><title>ScholarFolio</title><link rel="canonical" href="https://scholarfolio.org/" /></head><body><div id="root"></div></body></html>';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BROWSER = 'Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36';

async function get(path: string, ua = GOOGLEBOT): Promise<Response> {
  const context = { next: async () => new Response(SHELL, { headers: { 'content-type': 'text/html' } }) } as unknown as Context;
  return handler(new Request(`https://scholarfolio.org${path}`, { headers: { 'user-agent': ua } }), context);
}

beforeEach(() => {
  db.claims.clear();
  db.data.clear();
  db.down = false;
  db.claims.set('jonas-heller', { authorId: 'JH0000000000', slug: 'jonas-heller', displayName: null });
  db.data.set('JH0000000000', { name: 'Jonas Heller' });
  db.data.set('NOSPtp8AAAAJ', { name: 'Ada Lovelace' });
});

describe('og-meta handler', () => {
  it('404s unknown slugs and paths for crawlers, without a canonical', async () => {
    for (const path of ['/this-is-not-a-real-slug', '/foo/bar']) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(res.headers.get('x-robots-tag')).toContain('noindex');
      const html = await res.text();
      expect(html).not.toContain('canonical');
      expect(html).toContain('<div id="root">'); // still the SPA shell
    }
  });

  it('noindexes an uncached, unclaimed /scholar/<id> but keeps it 200', async () => {
    const res = await get('/scholar/ZZZZZZZZZZZZ');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(await res.text()).not.toContain('canonical');
  });

  it('serves valid profiles with their own canonical', async () => {
    const slug = await get('/jonas-heller');
    expect(slug.status).toBe(200);
    expect(await slug.text()).toContain('href="https://scholarfolio.org/jonas-heller"');
    const id = await get('/scholar/NOSPtp8AAAAJ');
    expect(id.status).toBe(200);
    expect(await id.text()).toContain('<title>Ada Lovelace — ScholarFolio</title>');
  });

  it('never 404s when the lookup itself fails', async () => {
    db.down = true;
    const res = await get('/jonas-heller');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });

  it('passes humans and app routes straight through', async () => {
    expect((await get('/this-is-not-a-real-slug', BROWSER)).status).toBe(200);
    for (const path of ['/', '/about', '/guides/', '/badge/abc', '/admin']) {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-robots-tag')).toBeNull();
    }
  });
});
