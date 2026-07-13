import React from 'react';

// Indexable landing content: what the product is, in the words people
// actually search with, plus an FAQ emitting FAQPage structured data.

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What is ScholarFolio?',
    a: 'ScholarFolio turns a Google Scholar profile into a clean academic portfolio page: citation trends over time, an interactive co-author network, field-normalized citation metrics, and a permanent shareable URL for your research profile.',
  },
  {
    q: 'Is ScholarFolio free?',
    a: 'Yes — looking up researcher profiles is free: 2 free searches without an account and 5 more when you create one. Viewing recently cached profiles never costs signed-in users a credit. Heavy users can buy affordable credit packs.',
  },
  {
    q: 'How is this different from Google Scholar itself?',
    a: 'Google Scholar lists publications; ScholarFolio tells the story around them. You get citation trend charts, a co-author collaboration map, percentile metrics normalized to your research field and career stage, and one polished page you can link from your website, CV, or email signature.',
  },
  {
    q: 'What is a good h-index?',
    a: 'It depends heavily on your field and career stage — an h-index of 15 can be outstanding in one discipline and average in another. That is why ScholarFolio shows field-normalized citation metrics that compare you to researchers in your own area rather than a single raw number.',
  },
  {
    q: 'Can I claim and verify my researcher profile?',
    a: 'Yes. Sign in, claim your profile, and verify ownership through your ORCID iD. Verified profiles get a permanent vanity URL (like scholarfolio.org/your-name), a verified badge, and the ability to correct profile details.',
  },
  {
    q: 'Where does the data come from?',
    a: 'Publication and citation data come from public Google Scholar profiles, enriched with open data from OpenAlex and Semantic Scholar for field-normalized metrics. Profiles are cached and refreshed regularly.',
  },
];

const faqJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}).replace(/</g, '\\u003c');

export function LandingSeoSections() {
  return (
    <section className="py-20 px-6 bg-white dark:bg-gray-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <div className="max-w-3xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1e293b] dark:text-gray-100 mb-6">
          Your academic portfolio, built from your Google Scholar profile
        </h2>
        <div className="space-y-4 text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-14">
          <p>
            ScholarFolio is a Google Scholar profile viewer and citation metrics dashboard for
            researchers. Paste a Scholar profile link or search a name, and get a complete picture in
            seconds: citation trends year by year, an interactive co-author network visualization,
            h-index and i10-index in context, and field-normalized metrics that show how a research
            record compares within its own discipline — not against a meaningless global average.
          </p>
          <p>
            Researchers use ScholarFolio as a personal academic portfolio website: claim your profile,
            verify it with your ORCID iD, and share one permanent URL on your homepage, CV, conference
            slides, or email signature. Hiring committees, collaborators, and journalists use it to
            understand a researcher's work at a glance — without clicking through hundreds of raw
            publication entries.
          </p>
        </div>

        <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1e293b] dark:text-gray-100 mb-6">
          Frequently asked questions
        </h2>
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm md:text-base font-medium text-[#1e293b] dark:text-gray-100">
                {q}
                <span className="text-[#2d7d7d] transition-transform group-open:rotate-45 text-lg leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
