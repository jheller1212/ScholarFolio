// Crawler-only text summary placed inside #root. JS-rendering crawlers (and
// the SPA for humans, who never get this HTML) replace it on mount; crawlers
// that don't run JS index real content instead of an empty shell. Only data
// already shown publicly on the profile page — never emails.
import { escapeAttr as esc } from './head.ts';
import type { Publication, ScholarData } from './supabase.ts';

export interface CoauthorLink {
  name: string;
  url: string;
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

function clean(s: string | undefined): string {
  return esc((s ?? '').replace(EMAIL, '').replace(/\s+/g, ' ').trim());
}

export function topPublications(pubs: Publication[] | undefined, n = 5): Publication[] {
  return (pubs ?? [])
    .filter((p) => p.title && p.title.trim())
    .slice()
    .sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0))
    .slice(0, n);
}

export function buildBody(data: ScholarData, authorId: string, coauthors: CoauthorLink[]): string {
  if (!data.name) return '';
  const parts: string[] = [`<h1>${clean(data.name)}</h1>`];
  if (data.affiliation) parts.push(`<p>${clean(data.affiliation)}</p>`);

  const metrics: string[] = [];
  if (data.totalCitations != null) metrics.push(`${data.totalCitations.toLocaleString('en-US')} citations`);
  if (data.hIndex != null) metrics.push(`h-index ${data.hIndex}`);
  if (data.metrics?.i10Index != null) metrics.push(`i10-index ${data.metrics.i10Index}`);
  if (metrics.length) parts.push(`<p>Google Scholar: ${metrics.join(' · ')}</p>`);

  const topics = (data.topics ?? []).map((t) => t.name).filter((t): t is string => !!t && !!t.trim());
  if (topics.length) {
    parts.push(`<h2>Research topics</h2>\n<ul>${topics.map((t) => `<li>${clean(t)}</li>`).join('')}</ul>`);
  }

  const top = topPublications(data.publications);
  if (top.length) {
    const items = top.map((p) => {
      // Scholar venue strings already end in the year; fall back to the year alone.
      const meta = clean(p.venue) || (p.year ? String(p.year) : '');
      const cites = p.citations != null ? ` ${p.citations.toLocaleString('en-US')} citations.` : '';
      return `<li><cite>${clean(p.title)}</cite>${meta ? ` (${meta})` : ''}.${cites}</li>`;
    });
    parts.push(`<h2>Most cited publications</h2>\n<ol>${items.join('')}</ol>`);
  }

  if (coauthors.length) {
    parts.push(`<h2>Co-authors on ScholarFolio</h2>\n<ul>${coauthors
      .map((c) => `<li><a href="${esc(c.url)}">${clean(c.name)}</a></li>`)
      .join('')}</ul>`);
  }

  if (!authorId.startsWith('openalex:')) {
    parts.push(`<p><a href="https://scholar.google.com/citations?user=${esc(encodeURIComponent(authorId))}" rel="nofollow">Google Scholar profile</a></p>`);
  }
  return `<main>\n${parts.join('\n')}\n</main>`;
}

export function injectBody(html: string, body: string): string {
  if (!body) return html;
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
}
