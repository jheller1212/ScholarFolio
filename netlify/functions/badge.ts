import type { Handler } from '@netlify/functions';

const supabaseUrl = 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable key — safe to embed, same as client-side
const supabaseAnonKey = 'sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

// Embeddable SVG badge for personal/university pages: shields.io-style,
// "ScholarFolio | 24,823 citations · h-index 63". Reads only the cache —
// never triggers a paid fetch. Served at /badge/<scholarId>.svg.

const CHAR_W = 6.15; // approx px per char at 11px Verdana
const PAD = 10;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBadge(label: string, value: string): string {
  const lw = Math.round(label.length * CHAR_W + PAD * 2);
  const vw = Math.round(value.length * CHAR_W + PAD * 2);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(`${label}: ${value}`)}">
  <title>${esc(`${label}: ${value}`)}</title>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#1e293b"/>
    <rect x="${lw}" width="${vw}" height="20" fill="#2d7d7d"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${esc(label)}</text>
    <text x="${lw + vw / 2}" y="14">${esc(value)}</text>
  </g>
</svg>`;
}

interface ScholarData {
  totalCitations?: number;
  hIndex?: number;
}

const handler: Handler = async (event) => {
  // Netlify 200-rewrites don't reliably interpolate :splat into query params,
  // but event.path keeps the original request path (/badge/<id>.svg).
  const fromPath = event.path.match(/\/badge\/([^/]+?)(?:\.svg)?$/i)?.[1];
  let raw: string;
  try {
    raw = decodeURIComponent(fromPath || event.queryStringParameters?.id || '').replace(/\.svg$/i, '');
  } catch {
    return { statusCode: 400, body: 'Invalid profile id' };
  }
  // Scholar IDs are alnum/_/-; OpenAlex fallbacks are "openalex:A<digits>"
  if (!/^[A-Za-z0-9_-]{5,30}$/.test(raw) && !/^openalex:A\d{4,15}$/.test(raw)) {
    return { statusCode: 400, body: 'Invalid profile id' };
  }

  let value = 'research profile';
  try {
    const scholarUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(raw)}`;
    const apiUrl = `${supabaseUrl}/rest/v1/scholar_cache?url=eq.${encodeURIComponent(scholarUrl)}&select=data&limit=1`;
    const res = await fetch(apiUrl, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ data: ScholarData }>;
      const d = rows?.[0]?.data;
      if (d && (d.totalCitations != null || d.hIndex != null)) {
        const parts: string[] = [];
        if (d.totalCitations != null) parts.push(`${d.totalCitations.toLocaleString('en-US')} citations`);
        if (d.hIndex != null) parts.push(`h-index ${d.hIndex}`);
        value = parts.join(' · ');
      }
    }
  } catch {
    // fall through to the generic badge
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Daily refresh is plenty for citation counts; SWR keeps it snappy
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Access-Control-Allow-Origin': '*',
    },
    body: renderBadge('ScholarFolio', value),
  };
};

export { handler };
