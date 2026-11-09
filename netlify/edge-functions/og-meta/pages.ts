// Per-route <head> for the SPA's content pages. Every route is served the same
// index.html, so without this /, /about, /trending ... all share one title and
// no canonical, and search engines fold them together as duplicates. Titles
// match the ones App.tsx sets client-side so the two never disagree.
import { DEFAULT_IMAGE, escapeAttr } from './head.ts';

const SITE = 'https://scholarfolio.org';

interface PageHead { title: string; description: string }

export const PAGE_HEADS: Record<string, PageHead> = {
  home: {
    title: 'ScholarFolio — Your research, at a glance',
    description:
      'Free, open-source research profiles from Google Scholar: citation trends, h-index and i10-index, co-author network and field-normalized metrics on one shareable page.',
  },
  about: {
    title: 'About & Funding — ScholarFolio',
    description:
      'Why ScholarFolio exists, where its data comes from (Google Scholar, OpenAlex, Semantic Scholar), and how this free, MIT-licensed academic project is funded.',
  },
  institutions: {
    title: 'For Institutions — ScholarFolio',
    description:
      'Sustaining membership for departments, graduate schools and libraries: fund an open research-profile tool your researchers already use, following the arXiv and OpenAlex model.',
  },
  trending: {
    title: 'Trending Researchers — ScholarFolio',
    description: 'The most-viewed researcher profiles on ScholarFolio this week, with citation counts and h-index.',
  },
  changelog: {
    title: 'Changelog — ScholarFolio',
    description: 'What changed in ScholarFolio, release by release: new metrics, CV exports, data sources and fixes.',
  },
  privacy: {
    title: 'Privacy Policy — ScholarFolio',
    description:
      'What ScholarFolio collects, why, how long it is kept, and your GDPR rights. First-party analytics only, no ads, no data sales.',
  },
  terms: {
    title: 'Terms of Use — ScholarFolio',
    description: 'The terms for using ScholarFolio, a free and open-source academic research profile tool.',
  },
};

export function pageUrl(page: string): string {
  return page === 'home' ? `${SITE}/` : `${SITE}/${page}`;
}

export function buildPageHead(page: string): { tags: string; title: string } | null {
  const head = PAGE_HEADS[page];
  if (!head) return null;
  const url = escapeAttr(pageUrl(page));
  const title = escapeAttr(head.title);
  const description = escapeAttr(head.description);
  const tags = `
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${DEFAULT_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="ScholarFolio" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ScholarFolio" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />`;
  return { tags, title: head.title };
}
