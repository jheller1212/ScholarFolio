// Generates the static grant guides: public/guides/<slug>/index.html, the
// /guides/ index page and public/guides/manifest.json (read by the sitemap).
//
//   node scripts/guides/build.mjs
//
// Output is committed, so Netlify serves it as plain static files that shadow
// the SPA fallback. Re-run after editing anything in scripts/guides/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, appLink, esc, formatDate, page } from './layout.mjs';
import { GUIDES } from './content/index.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../public/guides');
const CTA_LABEL = 'Generate a draft from your Google Scholar profile — free';

function ctaBlock(guide) {
  return `<div class="cta">
<p>${esc(guide.cta)}</p>
<a class="btn" href="${esc(appLink(guide))}">${esc(CTA_LABEL)}</a>
</div>`;
}

function renderGuide(guide) {
  const path = `/guides/${guide.slug}/`;
  const facts = guide.facts.length
    ? `<div class="card table-scroll"><table>${guide.facts
        .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`)
        .join('')}</table></div>`
    : '';
  const steps = `<h2 id="steps">${esc(guide.stepsHeading)}</h2>
<ol class="steps">${guide.steps.map(s => `<li><strong>${esc(s.title)}</strong>${s.html}</li>`).join('\n')}</ol>`;
  const sections = guide.sections.map(s => `<h2>${esc(s.h2)}</h2>\n${s.html}`).join('\n');
  const faq = `<h2 id="faq">Frequently asked questions</h2>
${guide.faqs.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}`;
  const sources = `<h2 id="sources">Official sources</h2>
<p class="meta">Last checked: <time datetime="${guide.lastChecked}">${formatDate(guide.lastChecked)}</time>. Funders update their forms every round; if anything here differs from the current call text, the call text wins.</p>
<ul class="sources">${guide.sources.map(s => `<li><a href="${esc(s.url)}" rel="nofollow noopener">${esc(s.label)}</a></li>`).join('')}</ul>`;
  const related = GUIDES.filter(g => g.slug !== guide.slug).slice(0, 4);
  const more = `<h2>More guides</h2><ul class="guides">${related
    .map(g => `<li><a href="/guides/${g.slug}/">${esc(g.h1)}</a></li>`)
    .join('')}</ul>`;

  const body = `<p class="crumbs"><a href="/guides/">Guides</a> › ${esc(guide.funder)}</p>
<h1>${esc(guide.h1)}</h1>
<p class="lede">${guide.lede}</p>
<p class="meta">Last checked against ${esc(guide.checkedAgainst ?? `official ${guide.funder} documents`)} on <time datetime="${guide.lastChecked}">${formatDate(guide.lastChecked)}</time>.</p>
${facts}
${ctaBlock(guide)}
${sections}
${steps}
${ctaBlock(guide)}
${faq}
${sources}
${more}`;

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: guide.faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Guides', item: `${SITE}/guides/` },
        { '@type': 'ListItem', position: 2, name: guide.h1, item: `${SITE}${path}` },
      ],
    },
  ];

  return page({ path, title: guide.title, description: guide.description, body, structuredData });
}

function renderIndex() {
  const title = 'Narrative CV guides for grant applications — ScholarFolio';
  const description =
    'Plain-language guides to the CV formats funders now ask for: NWO, ERC, MSCA and more. Each guide is checked against the official funder documents.';
  const body = `<h1>Narrative CV guides for grant applications</h1>
<p class="lede">Funders increasingly replace publication lists and h-indices with narrative and evidence-based CVs. These guides summarise what each format asks for, link to the official documents, and show how to turn your Google Scholar profile into a first draft.</p>
<ul class="guides">${GUIDES.map(
    g => `<li><a href="/guides/${g.slug}/">${esc(g.h1)}</a><span>${esc(g.summary)}</span></li>`,
  ).join('')}</ul>
<div class="cta"><p>ScholarFolio exports editable Word drafts in NWO, ERC and MSCA formats from your public profile.</p><a class="btn" href="/?tab=cv&amp;utm_source=guide&amp;utm_medium=organic&amp;utm_campaign=guides-index">Generate a draft from your Google Scholar profile — free</a></div>`;
  return page({
    path: '/guides/',
    title,
    description,
    ogType: 'website',
    body,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Narrative CV guides for grant applications',
        url: `${SITE}/guides/`,
        hasPart: GUIDES.map(g => ({ '@type': 'WebPage', name: g.h1, url: `${SITE}/guides/${g.slug}/` })),
      },
    ],
  });
}

function write(file, contents) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

for (const guide of GUIDES) write(join(OUT, guide.slug, 'index.html'), renderGuide(guide));
write(join(OUT, 'index.html'), renderIndex());

const newest = GUIDES.map(g => g.lastChecked).sort().at(-1);
const manifest = {
  generated: 'scripts/guides/build.mjs',
  pages: [
    { path: '/guides/', title: 'Narrative CV guides for grant applications', lastmod: newest },
    ...GUIDES.map(g => ({ path: `/guides/${g.slug}/`, title: g.h1, lastmod: g.lastChecked, format: g.format ?? null })),
  ],
};
write(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${GUIDES.length} guides + index to public/guides/`);
