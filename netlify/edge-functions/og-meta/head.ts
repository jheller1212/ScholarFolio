// Builds the per-profile <head> tags crawlers see. Pure string work so it can
// be unit-tested with vitest.
import type { ScholarData } from './supabase.ts';

const SITE = 'https://scholarfolio.org';
const DEFAULT_TITLE = 'ScholarFolio — Academic Research Profiles';
const DEFAULT_DESCRIPTION =
  'Explore research profiles, citation metrics, and co-author networks for academics worldwide.';
export const DEFAULT_IMAGE = `${SITE}/og-default.png`;

export interface HeadInput {
  data: ScholarData;
  authorId: string;
  claimedSlug: string | null;
  // Shown when the profile isn't cached yet (claimed display name / slug).
  fallbackName?: string | null;
  // ScholarFolio URLs of confirmed co-authors (schema.org colleague).
  colleagues?: string[];
}

export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function canonicalUrl(authorId: string, claimedSlug: string | null): string {
  // Claimed profiles' canonical is their vanity slug (also what the sitemap
  // lists); unclaimed profiles canonicalize to /scholar/<id>.
  return claimedSlug ? `${SITE}/${claimedSlug}` : `${SITE}/scholar/${encodeURIComponent(authorId)}`;
}

export function slugToName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Generated 1200×630 card (netlify/functions/og-image). The query string
// versions it by the headline metrics so platforms re-fetch when they change;
// the function falls back to the default card on any error. OpenAlex-only
// profiles aren't in scholar_cache under their id, so they keep the default.
export function shareCardUrl(name: string | undefined, data: ScholarData, authorId: string): string {
  if (!name || authorId.startsWith('openalex:')) return DEFAULT_IMAGE;
  const version = `${data.totalCitations ?? 0}-${data.hIndex ?? 0}`;
  return `${SITE}/og/${encodeURIComponent(authorId)}.png?v=${version}`;
}

export function buildDescription(name: string | undefined, data: ScholarData): string {
  if (!name) return DEFAULT_DESCRIPTION;
  const parts: string[] = [];
  if (data.affiliation) parts.push(data.affiliation);
  if (data.totalCitations != null) parts.push(`${data.totalCitations.toLocaleString('en-US')} citations`);
  if (data.hIndex != null) parts.push(`h-index ${data.hIndex}`);
  const lead = parts.length > 0 ? `${name}: ${parts.join(' · ')}.` : `${name} on ScholarFolio.`;
  return `${lead} Citation trends, co-author network, and field-normalized metrics on ScholarFolio.`;
}

export function buildHead({ data, authorId, claimedSlug, fallbackName, colleagues }: HeadInput): { tags: string; title: string } {
  const name = data.name || fallbackName || undefined;
  const title = name ? `${name} — ScholarFolio` : DEFAULT_TITLE;
  const description = buildDescription(name, data);
  const image = shareCardUrl(name, data, authorId);
  const url = canonicalUrl(authorId, claimedSlug);

  // schema.org Person — structured data for search engines. JSON.stringify
  // handles escaping; "<" is additionally escaped so cached profile text can
  // never break out of the script element.
  let jsonLd = '';
  if (name) {
    const person: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name,
      url,
      mainEntityOfPage: url,
    };
    if (data.affiliation) person.affiliation = { '@type': 'Organization', name: data.affiliation };
    const topics = (data.topics ?? []).map((t) => t.name).filter((t): t is string => !!t);
    if (topics.length) person.knowsAbout = topics;
    if (colleagues?.length) person.colleague = colleagues;
    if (!authorId.startsWith('openalex:')) {
      person.sameAs = [`https://scholar.google.com/citations?user=${encodeURIComponent(authorId)}`];
    }
    const payload = JSON.stringify(person).replace(/</g, '\\u003c');
    jsonLd = `\n    <script type="application/ld+json">${payload}</script>`;
  }

  const tags = `
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${escapeAttr(url)}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeAttr(name ? `${name} on ScholarFolio` : 'ScholarFolio')}" />
    <meta property="og:url" content="${escapeAttr(url)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="ScholarFolio" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />${jsonLd}`;

  return { tags, title };
}

export function injectHead(html: string, tags: string, title: string): string {
  // Remove tags we replace: og:/twitter: metas, the static description and any
  // canonical, and swap the <title> so search engines index a unique one per
  // profile.
  const cleaned = html
    .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '')
    .replace(/<meta\s+name="description"[^>]*\/?>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*\/?>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);

  return cleaned.replace('</head>', `${tags}\n  </head>`);
}
