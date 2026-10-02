import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Handler } from '@netlify/functions';
import { guideEntries, profileEntries, renderSitemap, SITE, STATIC_PAGES } from './entries.ts';
import type { CacheRow, ClaimRow } from './entries.ts';

const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable key — safe to embed, same as client-side
const SUPABASE_ANON_KEY = 'sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

// Cached profiles older than this are left out: the cache is pruned after its
// TTL anyway, and a stale lastmod only wastes crawl budget.
const RECENT_DAYS = 90;
const GUIDES_MANIFEST = 'public/guides/manifest.json';

async function rest<T>(query: string): Promise<T[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as T[]) : [];
  } catch {
    return [];
  }
}

// Guides are static files owned by the guides build; the manifest is shipped
// with the function (included_files) and fetched from the site as a fallback,
// so the sitemap keeps working whether or not the manifest exists.
async function loadGuidesManifest(): Promise<unknown> {
  for (const root of [process.cwd(), process.env.LAMBDA_TASK_ROOT, '/var/task']) {
    if (!root) continue;
    const file = join(root, GUIDES_MANIFEST);
    if (existsSync(file)) {
      try {
        return JSON.parse(await readFile(file, 'utf8'));
      } catch {
        break;
      }
    }
  }
  try {
    const res = await fetch(`${SITE}/guides/manifest.json`, { signal: AbortSignal.timeout(3000) });
    // The SPA catch-all answers missing files with index.html, hence the type check.
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) return await res.json();
  } catch {
    // no guides yet
  }
  return null;
}

const handler: Handler = async () => {
  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();
  const [claims, cache, manifest] = await Promise.all([
    rest<ClaimRow>('claimed_profiles?select=slug,author_id,updated_at&order=updated_at.desc'),
    rest<CacheRow>(
      `scholar_cache?select=url,created_at&url=like.${encodeURIComponent('https://scholar.google.com/citations?user=*')}` +
      `&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=5000`,
    ),
    loadGuidesManifest(),
  ]);

  const xml = renderSitemap([...STATIC_PAGES, ...guideEntries(manifest), ...profileEntries(claims, cache)]);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
    body: xml,
  };
};

export { handler };
