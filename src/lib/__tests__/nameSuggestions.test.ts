import { isTypeaheadNameQuery, rankNameSuggestions, scoreNameSuggestion, suggestionQueries, type NameSuggestion } from '../nameSuggestions';
import { editDistance, editDistanceWithin } from '../editDistance';

const s = (id: string, name: string, citedBy = 0, institution = ''): NameSuggestion => ({ id, name, citedBy, institution });

describe('editDistance', () => {
  it('computes Levenshtein distance', () => {
    expect(editDistance('hilkn', 'hilken')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
  });

  it('caps at max + 1 once the bound is exceeded', () => {
    expect(editDistance('hellr', 'hellrung', 2)).toBe(3);
    expect(editDistanceWithin('heller', 'hellr', 1)).toBe(true);
    expect(editDistanceWithin('heller', 'smith', 2)).toBe(false);
  });
});

describe('suggestionQueries', () => {
  it('adds the surname shortened by one and two letters', () => {
    expect(suggestionQueries('Tim Hilkn')).toEqual(['Tim Hilkn', 'Tim Hilk', 'Tim Hil']);
    expect(suggestionQueries('Joshanlo')).toEqual(['Joshanlo', 'Joshanl', 'Joshan']);
  });

  it('never shortens a surname below three letters', () => {
    expect(suggestionQueries('Ko Ruy')).toEqual(['Ko Ruy']);
    expect(suggestionQueries('Jo Mahr')).toEqual(['Jo Mahr', 'Jo Mah']);
  });

  it('keeps compound names and collapses whitespace', () => {
    expect(suggestionQueries('  Ko  de Ruytr ')).toEqual(['Ko de Ruytr', 'Ko de Ruyt', 'Ko de Ruy']);
    expect(suggestionQueries('')).toEqual([]);
  });
});

describe('scoreNameSuggestion', () => {
  it('accepts a close surname with a compatible given name', () => {
    expect(scoreNameSuggestion('Tim Hilkn', 'Tim Hilken')).toBe(10);
    expect(scoreNameSuggestion('T Hilkn', 'Tim Hilken')).toBe(11);
    expect(scoreNameSuggestion('Joshanlo', 'Mohsen Joshanloo')).toBe(10);
    expect(scoreNameSuggestion('Jonas Hellr', 'Jönas Heller')).toBe(10);
  });

  it('rejects a far surname or a different given name', () => {
    expect(scoreNameSuggestion('Jonas Hellr', 'Jonas Hellrung')).toBeNull();
    expect(scoreNameSuggestion('Tim Hilkn', 'Anna Hilken')).toBeNull();
    expect(scoreNameSuggestion('Tim Hilkn', 'Tim Smith')).toBeNull();
  });
});

describe('rankNameSuggestions', () => {
  const candidates = [
    s('A1', 'Jonas Hellrung', 1387, 'RWTH Aachen University'),
    s('A2', 'Jonas Helma', 2318),
    s('A3', 'Jonas Heller', 2805, 'Maastricht University'),
    s('A3', 'Jonas Heller', 2805, 'Maastricht University'),
    s('A4', 'Jonas Heller', 12),
    s('A5', 'Jonas Hellr', 5),
  ];

  it('puts the closest name first and drops incompatible ones', () => {
    const ranked = rankNameSuggestions('Jonas Hellr', candidates);
    expect(ranked.map(r => r.id)).toEqual(['A3', 'A2']);
    expect(ranked[0].institution).toBe('Maastricht University');
  });

  it('drops the typed name itself and same-name duplicates, keeping the most cited', () => {
    const ranked = rankNameSuggestions('Jonas Hellr', candidates);
    expect(ranked.some(r => r.id === 'A5')).toBe(false);
    expect(ranked.filter(r => r.name === 'Jonas Heller')).toHaveLength(1);
  });

  it('breaks score ties by citations and respects the limit', () => {
    const ranked = rankNameSuggestions('Tim Hilkn', [
      s('B1', 'Tim Hilker', 10),
      s('B2', 'Tim Hilken', 2707),
      s('B3', 'Tim Hilkin', 500),
    ], 2);
    expect(ranked.map(r => r.id)).toEqual(['B2', 'B3']);
  });
});

describe('isTypeaheadNameQuery', () => {
  it('accepts names, including diacritics, hyphens and apostrophes', () => {
    expect(isTypeaheadNameQuery('Tim Hil')).toBe(true);
    expect(isTypeaheadNameQuery('Jörg Müller-Lüdenscheidt')).toBe(true);
    expect(isTypeaheadNameQuery("O'Brien")).toBe(true);
  });

  it('skips short input, URLs and Scholar profile ids', () => {
    expect(isTypeaheadNameQuery('Ti')).toBe(false);
    expect(isTypeaheadNameQuery('https://scholar.google.com/citations?user=NOSPtp8AAAAJ')).toBe(false);
    expect(isTypeaheadNameQuery('scholar.google.com/citations')).toBe(false);
    expect(isTypeaheadNameQuery('NOSPtp8AAAAJ')).toBe(false);
    expect(isTypeaheadNameQuery('www.example')).toBe(false);
    expect(isTypeaheadNameQuery('example.com')).toBe(false);
  });
});
