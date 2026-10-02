import { describe, expect, it } from 'vitest';
import { buildBody, injectBody, topPublications } from '../body.ts';
import { candidateProfiles, frequentCoauthorKeys, listsAuthor, nameKey } from '../coauthors.ts';

describe('nameKey', () => {
  it('matches Scholar initials against full names', () => {
    expect(nameKey('MA Zaki')).toBe('m zaki');
    expect(nameKey('Mohamed Zaki')).toBe('m zaki');
    expect(nameKey('Frédéric Dufays')).toBe('f dufays');
    expect(nameKey('...')).toBeNull();
    expect(nameKey('Plato')).toBeNull();
  });
});

describe('co-author matching', () => {
  const pubs = [
    { title: 'A', authors: ['J Heller', 'T Mandler', 'X Other'] },
    { title: 'B', authors: ['J Heller', 'T Mandler'] },
  ];

  it('ranks co-authors by shared papers and excludes the researcher', () => {
    expect(frequentCoauthorKeys(pubs, 'Jonas Heller')).toEqual(['t mandler', 'x other']);
  });

  it('finds cached candidates but never the profile itself', () => {
    const index = [
      { id: 'SELF', name: 'Jonas Heller', slug: 'jonas-heller' },
      { id: 'TM', name: 'Timo Mandler', slug: null },
      { id: 'ZZ', name: 'Zed Zulu', slug: null },
    ];
    expect(candidateProfiles(['t mandler', 'j heller'], index, 'SELF').map((p) => p.id)).toEqual(['TM']);
  });

  it('requires the candidate to list the researcher back', () => {
    expect(listsAuthor(['J Heller', 'K Smith'], 'Jonas Heller')).toBe(true);
    expect(listsAuthor(['K Smith'], 'Jonas Heller')).toBe(false);
  });
});

describe('buildBody', () => {
  const data = {
    name: 'Ada Lovelace',
    affiliation: 'Analytical Society, ada@example.org',
    totalCitations: 1200,
    hIndex: 9,
    topics: [{ name: 'Computing' }],
    publications: [
      { title: 'Low', citations: 1, year: 2020 },
      { title: 'Notes <on> the Engine', citations: 900, year: 1843, venue: 'Taylor' },
    ],
  };

  it('summarises the public profile with escaped text and no emails', () => {
    const html = buildBody(data, 'ABCDEF123456', [{ name: 'Charles Babbage', url: 'https://scholarfolio.org/charles-babbage' }]);
    expect(html).toContain('<h1>Ada Lovelace</h1>');
    expect(html).not.toContain('@example.org');
    expect(html).toContain('Notes &lt;on&gt; the Engine');
    expect(html.indexOf('Notes')).toBeLessThan(html.indexOf('Low'));
    expect(html).toContain('href="https://scholarfolio.org/charles-babbage"');
    expect(html).toContain('<li>Computing</li>');
  });

  it('renders nothing without a name and injects into the empty root only', () => {
    expect(buildBody({}, 'X', [])).toBe('');
    expect(injectBody('<div id="root"></div>', '<main>x</main>')).toBe('<div id="root"><main>x</main></div>');
  });

  it('keeps the top five by citations', () => {
    const pubs = Array.from({ length: 8 }, (_, i) => ({ title: `P${i}`, citations: i }));
    expect(topPublications(pubs).map((p) => p.title)).toEqual(['P7', 'P6', 'P5', 'P4', 'P3']);
  });
});
