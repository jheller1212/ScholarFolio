// Canonical venue-name normalization, shared by the top-venue counter
// (ResearcherNarrative) and the journal-ranking matcher (journalRankings) so the
// two stay consistent — a journal that's counted is normalized the same way it's
// looked up for FT50/ABS tags.

// Common ISO-4-style journal abbreviations → canonical full names. An abbreviated
// venue string ("Comput. Hum. Behav.") folds into the same key as the full name
// instead of splitting the count. Keys are in already-normalized form (lowercased,
// punctuation-stripped). Only EXACT matches expand, so distinct journals are never
// conflated (e.g. "computers in human behavior reports" stays separate).
const VENUE_ABBREVIATIONS: Record<string, string> = {
  'comput hum behav': 'computers in human behavior',
  'j mark': 'journal of marketing',
  'j mark res': 'journal of marketing research',
  'j consum res': 'journal of consumer research',
  'j consum psychol': 'journal of consumer psychology',
  'j retail': 'journal of retailing',
  'j retail consum serv': 'journal of retailing and consumer services',
  'j bus res': 'journal of business research',
  'j serv res': 'journal of service research',
  'j serv manag': 'journal of service management',
  'int j res mark': 'international journal of research in marketing',
  'j acad mark sci': 'journal of the academy of marketing science',
  'eur j mark': 'european journal of marketing',
  'ind mark manag': 'industrial marketing management',
  'psychol mark': 'psychology and marketing',
  'psychol sci': 'psychological science',
  'mark sci': 'marketing science',
  'mis q': 'mis quarterly',
  'inf syst res': 'information systems research',
};

/**
 * Normalize a raw venue string to a canonical match key: strip volume/issue/page
 * suffixes, parentheticals, conference/proceedings tails, and punctuation; collapse
 * whitespace; fold `&`→`and` and a leading `the`; then expand known abbreviations.
 * Returns '' when nothing meaningful remains.
 */
export function normalizeVenueName(name: string): string {
  if (!name) return '';
  const base = name.toLowerCase()
    .replace(/,.*$/, '')            // drop everything after the first comma (vol/page)
    .replace(/\s+\d+.*$/, '')       // drop volume/issue numbers and everything after
    .replace(/\([^)]*\)/g, '')      // drop parenthetical content
    .replace(/proceedings.*$/i, '')
    .replace(/conference.*$/i, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:\-]/g, '')       // strip punctuation (folds "behavior." → "behavior")
    .replace(/&/g, 'and')
    .replace(/^the\s+/, '');
  return VENUE_ABBREVIATIONS[base] ?? base;
}
