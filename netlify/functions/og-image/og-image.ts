import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import type { Config } from '@netlify/functions';
import { buildCardSvg } from './card.ts';
import { cardInputFor, fetchCardSource } from './data.ts';

// Generated 1200×630 PNG share card for a profile, used as og:image by the
// og-meta edge function. Reads only the cache — never triggers a paid fetch.
// Any failure redirects to the static default card so a preview never breaks.

export const config: Config = { path: '/og/:file' };

const DEFAULT_CARD = '/og-default.png';
const FONT_FILES = ['dm-sans-400.ttf', 'dm-sans-700.ttf', 'playfair-display-700.ttf'];
const WASM_FILE = 'node_modules/@resvg/resvg-wasm/index_bg.wasm';
const FONT_DIR = 'netlify/functions/og-image/fonts';

// included_files (netlify.toml) keep their repo-relative paths, but the root
// they hang off differs between Lambda and `netlify dev`.
function resolveIncluded(relPath: string): string {
  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT, '/var/task'].filter((r): r is string => !!r);
  for (const root of roots) {
    const candidate = join(root, relPath);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`og-image: missing bundled file ${relPath}`);
}

let renderer: Promise<Uint8Array[]> | null = null;

// Wasm init and font reads happen once per warm container.
function loadRenderer(): Promise<Uint8Array[]> {
  if (!renderer) {
    renderer = (async () => {
      await initWasm(await readFile(resolveIncluded(WASM_FILE)));
      return Promise.all(FONT_FILES.map(async (f) => new Uint8Array(await readFile(resolveIncluded(`${FONT_DIR}/${f}`)))));
    })();
    renderer.catch(() => { renderer = null; });
  }
  return renderer;
}

function fallback(): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: DEFAULT_CARD, 'Cache-Control': 'public, max-age=300' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const file = new URL(req.url).pathname.split('/').pop() ?? '';
  const match = file.match(/^(.+)\.png$/);
  if (!match) return fallback();

  let authorId: string;
  try {
    authorId = decodeURIComponent(match[1]);
  } catch {
    return fallback();
  }

  try {
    const source = await fetchCardSource(authorId);
    const input = source && cardInputFor(authorId, source);
    if (!input) return fallback();

    const fontBuffers = await loadRenderer();
    const png = new Resvg(buildCardSvg(input), {
      fitTo: { mode: 'original' },
      font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'DM Sans' },
    }).render().asPng();

    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        // og-meta versions the URL with the headline metrics, so a cached
        // card is never stale for the numbers it shows.
        'Cache-Control': 'public, max-age=86400',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=2592000, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[og-image] render failed', authorId, err);
    return fallback();
  }
}
