import type { Author } from '../../types/scholar';
import { findJournalRanking } from '../../data/journalRankings';
import { normalizeVenueName } from '../../utils/venue';
import { THEME_STOP_WORDS } from './stopWords';

// Pure text/statistics helpers the narrative paragraphs are built from.
// Kept free of React so the PDF and narrative-CV exports reuse them verbatim.

export function getCareerSpan(publications: Author['publications']): { firstYear: number; lastYear: number; years: number } {
  const currentYear = new Date().getFullYear();
  // Filter out garbage years: must be after 1950 and not in the future
  let years = publications.map(p => p.year).filter(y => y >= 1950 && y <= currentYear + 1);
  if (years.length === 0) return { firstYear: 0, lastYear: 0, years: 0 };

  // Remove statistical outliers on the early end (misattributed old publications).
  // Use IQR-based fence, but never tighter than 10 years below Q1: researchers whose
  // output clusters in a few recent years would otherwise lose a genuine early paper
  // (e.g. Q1=2023, Q3=2025 gives a fence at 2020 and drops a real 2019 first publication).
  if (years.length >= 5) {
    const sorted = [...years].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerFence = q1 - Math.max(1.5 * iqr, 10);
    years = years.filter(y => y >= lowerFence);
  }

  if (years.length === 0) return { firstYear: 0, lastYear: 0, years: 0 };
  const firstYear = years.reduce((a, b) => a < b ? a : b);
  const lastYear = years.reduce((a, b) => a > b ? a : b);
  return { firstYear, lastYear, years: lastYear - firstYear + 1 };
}

export function getTopVenues(publications: Author['publications'], limit: number): { name: string; count: number }[] {
  // Map from lowercased key → { displayName (most common casing), count }
  const venueCounts = new Map<string, { displayName: string; count: number; displayCounts: Map<string, number> }>();
  publications.forEach(pub => {
    const venue = pub.venue?.trim();
    if (venue && venue.length > 0) {
      // Normalize: strip volume/issue/page info (e.g. ", vol. 15", ", 34(2)")
      // but preserve commas that are part of journal names
      const baseName = venue
        .replace(/,\s*(?:vol\.?|no\.?|pp\.?|issue|pages?|supplement)\s.*/i, '')
        .replace(/\s+\d+\s*\([\d()–\-]+\)[\s,.\d–\-]*$/, '')
        .replace(/,\s*\d[\d()–\-\s]*$/, '')
        .replace(/\s+\d+\s*,.*$/, '')
        .replace(/\s+\d+\s*$/, '')
        // Collapse internal whitespace and strip trailing punctuation so
        // "Computers in Human Behavior." folds into "Computers in Human Behavior"
        // rather than splitting the count. Distinct titles (e.g. "… Reports")
        // are preserved.
        .replace(/\s+/g, ' ')
        .replace(/[.,;:]+$/, '')
        .trim();
      // Skip non-journal venues (repositories, working papers, etc.)
      const lowerBase = baseName.toLowerCase();
      const isNonJournal = /\b(ssrn|arxiv|researchgate|netspar|rijksoverheid|working paper|discussion paper|technical report|preprint|mimeo|unpublished|available at|course|thesis|dissertation|patent|us patent|google patent|university press|academic press|verlag|publisher|editora)\b/i.test(lowerBase);
      if (isNonJournal || baseName.length <= 3) return;

      // Group on the canonical key (shared with journal-ranking lookup) so
      // abbreviations and punctuation/whitespace variants fold together, while
      // the human-readable baseName is kept for display.
      const key = normalizeVenueName(venue);
      if (key.length >= 3) {
        const existing = venueCounts.get(key);
        if (existing) {
          existing.count++;
          existing.displayCounts.set(baseName, (existing.displayCounts.get(baseName) || 0) + 1);
          // Use the most frequently seen casing as display name
          let maxCount = 0;
          for (const [name, cnt] of existing.displayCounts) {
            if (cnt > maxCount) { maxCount = cnt; existing.displayName = name; }
          }
        } else {
          const displayCounts = new Map<string, number>();
          displayCounts.set(baseName, 1);
          venueCounts.set(key, { displayName: baseName, count: 1, displayCounts });
        }
      }
    }
  });

  // Score venues by prestige: FT50 > ABS rank > impact factor > publication count
  function prestigeScore(venue: string): number {
    const ranking = findJournalRanking(venue);
    if (!ranking) return 0;
    let score = 0;
    if (ranking.ft50) score += 1000;
    if (ranking.abs === '4*') score += 500;
    else if (ranking.abs === '4') score += 400;
    else if (ranking.abs === '3') score += 300;
    else if (ranking.abs === '2') score += 200;
    else if (ranking.abs === '1') score += 100;
    if (ranking.jcr) score += Math.min(parseFloat(ranking.jcr) * 10, 200);
    return score;
  }

  return Array.from(venueCounts.values())
    .sort((a, b) => {
      // Primary sort: publication count (descending) — narrative says "most frequent"
      if (b.count !== a.count) return b.count - a.count;
      // Tiebreak: prestige
      return prestigeScore(b.displayName) - prestigeScore(a.displayName);
    })
    .slice(0, limit)
    .map(v => ({ name: v.displayName, count: v.count }));
}

export function getProductivityPhase(publications: Author['publications']): string {
  const currentYear = new Date().getFullYear();
  const recentPubs = publications.filter(p => p.year >= currentYear - 3).length;
  const olderPubs = publications.filter(p => p.year >= currentYear - 6 && p.year < currentYear - 3).length;

  if (recentPubs === 0) return 'inactive';
  if (olderPubs === 0) return recentPubs >= 10 ? 'accelerating' : 'emerging';
  const ratio = recentPubs / Math.max(olderPubs, 1);
  if (ratio > 1.3) return 'accelerating';
  if (ratio > 0.7) return 'steady';
  return 'decelerating';
}

export function getMostCitedPaper(publications: Author['publications']): Author['publications'][0] | null {
  if (publications.length === 0) return null;
  return publications.reduce((max, p) => p.citations > max.citations ? p : max, publications[0]);
}

/**
 * Parse an affiliation string into a position/title and an institution.
 * Google Scholar (and SerpAPI) often returns strings like:
 *   "Assistant Professor in Marketing, Maastricht University School of Business and Economics"
 *   "PhD Student, Stanford University"
 *   "Professor of Computer Science, MIT"
 * We split on the first comma that likely separates position from institution.
 */
export function parseAffiliation(raw: string): { position: string; institution: string } {
  if (!raw) return { position: '', institution: '' };

  // Common academic title keywords that signal the start is a position, not an institution
  const titlePatterns = /^(professor|prof\.|assistant|associate|lecturer|instructor|postdoc|post-doc|phd|doctoral|research\s+(scientist|fellow|associate|assistant)|visiting|adjunct|emeritus|dean|chair|director|senior\s+lecturer|junior\s+professor)/i;

  const commaIdx = raw.indexOf(',');
  if (commaIdx === -1) {
    // No comma — decide if the whole thing is a position or institution
    if (titlePatterns.test(raw.trim())) {
      return { position: raw.trim(), institution: '' };
    }
    return { position: '', institution: raw.trim() };
  }

  const before = raw.slice(0, commaIdx).trim();
  const after = raw.slice(commaIdx + 1).trim();

  if (titlePatterns.test(before)) {
    return { position: before, institution: after };
  }

  // No recognisable title — treat the whole string as the institution
  return { position: '', institution: raw.trim() };
}

/**
 * Extract dominant themes from a set of publication titles.
 * Returns lowercased bigrams/trigrams that appear frequently.
 */
export function extractTitleThemes(publications: Author['publications'], authorName?: string, fieldTopics?: string[]): string[] {
  const bigramCounts = new Map<string, number>();

  for (const pub of publications) {
    // Skip non-English titles: non-Latin scripts are always excluded; for diacritics,
    // use a ratio check to allow English titles with occasional accented proper nouns
    if (/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(pub.title)) continue;
    const alphaChars = pub.title.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿĀ-ſ]/g, '');
    const nonAsciiCount = (pub.title.match(/[À-ÖØ-öø-ÿĀ-ſ]/g) || []).length;
    if (alphaChars.length > 0 && nonAsciiCount / alphaChars.length > 0.15) continue;

    const words = pub.title.toLowerCase()
      .replace(/[^a-z\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !THEME_STOP_WORDS.has(w));

    // Only count bigrams — they are far better topic labels than single words.
    // "virtual reality" > "virtual"; "machine learning" > "learning"
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
    }
  }

  // Build a set of author name words to exclude (e.g., "ruyter wetzels")
  const authorWords = new Set<string>();
  if (authorName) {
    for (const part of authorName.toLowerCase().split(/\s+/)) {
      if (part.length > 2) authorWords.add(part);
    }
  }
  // Build a set of exact topic phrases to exclude (avoid repeating field labels as themes)
  const topicPhrases = new Set<string>();
  if (fieldTopics) {
    for (const topic of fieldTopics) {
      topicPhrases.add(topic.toLowerCase().trim());
    }
  }

  // Minimum frequency: ≥2 for small corpora, ≥3 for larger ones (reduces noise)
  const minCount = publications.length >= 50 ? 3 : 2;

  const sorted = Array.from(bigramCounts.entries())
    .filter(([term, count]) => {
      if (count < minCount) return false;
      const words = term.split(' ');
      // Skip bigrams containing author name parts (e.g., "ruyter wetzels")
      if (words.some(w => authorWords.has(w))) return false;
      // Skip bigrams that exactly match a field topic (avoid repeating discipline labels)
      if (topicPhrases.has(term)) return false;
      // Skip bigrams where both words are ≤3 chars (likely noise)
      if (words.every(w => w.length <= 3)) return false;
      // Skip bigrams that are only Latin/non-English characters patterns
      // (heuristic: if both words have no common English letter patterns)
      return true;
    })
    .sort((a, b) => b[1] - a[1]);

  // Deduplicate: skip bigrams that heavily overlap with already-selected ones
  // e.g., if "virtual reality" is selected, skip "augmented virtual"
  const selected: string[] = [];
  for (const [term] of sorted) {
    if (selected.length >= 6) break;
    const words = term.split(' ');
    // Skip if either word in this bigram is already the key word in a selected bigram
    const overlaps = selected.some(s => {
      const sw = s.split(' ');
      return words.some(w => sw.includes(w));
    });
    if (overlaps) continue;
    selected.push(term);
  }
  return selected;
}

/** Infer research methods/approaches from publication titles. */
export function inferResearchMethods(publications: Author['publications']): string[] {
  // Only use academic paper titles — skip book-like titles, interviews, memoirs
  const academicTitles = publications
    .filter(p => !/\b(interview|memoir|autobiography|biography|lecture|speech|letter|obituary|tribute|foreword|preface|afterword)\b/i.test(p.title))
    .map(p => p.title.toLowerCase());
  const titleCorpus = academicTitles.join(' ');

  // Each pattern: [regex to test against joined titles, human-readable label]
  const methodPatterns: [RegExp, string][] = [
    [/\bmeta[- ]?analy/, 'meta-analysis'],
    [/\brandomized|randomised|\brct\b/, 'randomized controlled trials'],
    [/\bexperiment(?:al|s)?\b/, 'experimental methods'],
    [/\blongitudinal\b/, 'longitudinal studies'],
    [/\bcross[- ]?sectional\b/, 'cross-sectional analysis'],
    [/\bsurvey(?:s|ing)?\b/, 'survey research'],
    [/\binterview(?:s|ing)?\b/, 'interview-based research'],
    [/\bethnograph/, 'ethnographic methods'],
    [/\bqualitative\b/, 'qualitative methods'],
    [/\bcase stud(?:y|ies)\b/, 'case study research'],
    [/\bmachine learning|deep learning|\bneural net/, 'machine learning'],
    [/\bnatural language processing|\bnlp\b/, 'natural language processing'],
    [/\bsimulat(?:ion|ing|e)\b/, 'simulation'],
    [/\bcomputational\b/, 'computational approaches'],
    [/\bstatistical\b/, 'statistical analysis'],
    [/\bregression\b/, 'regression analysis'],
    [/\bstructural equation\b/, 'structural equation modeling'],
    [/\bgrounded theory\b/, 'grounded theory'],
    [/\bsystematic review\b/, 'systematic reviews'],
    [/\bliterature review\b/, 'literature reviews'],
    [/\bempirical\b/, 'empirical analysis'],
    [/\bfield (?:study|experiment|research)\b/, 'field research'],
    [/\baction research\b/, 'action research'],
    [/\bmixed[- ]?method/, 'mixed-methods research'],
    [/\bgenome|genomic|proteomic|transcriptom/, 'genomics/proteomics'],
    [/\bclinical trial/, 'clinical trials'],
    [/\bcohort\b/, 'cohort studies'],
    [/\bnetwork analysis\b/, 'network analysis'],
    [/\btext mining|sentiment analysis/, 'text mining'],
    [/\bbayesian\b/, 'Bayesian methods'],
    [/\bdesign science\b/, 'design science'],
    [/\barchival\b/, 'archival research'],
    [/\beconometric/, 'econometric analysis'],
    [/\bpanel data\b/, 'panel data analysis'],
    [/\binstrumental variable/, 'instrumental variable methods'],
    [/\bdifference[- ]?in[- ]?difference/, 'difference-in-differences'],
  ];

  const detected: string[] = [];
  for (const [regex, label] of methodPatterns) {
    if (regex.test(titleCorpus)) {
      detected.push(label);
    }
  }
  return detected.slice(0, 4); // Cap at 4 to keep the sentence readable
}

/**
 * Infer an academic discipline label from the affiliation and/or topics.
 * E.g. "Assistant Professor in Marketing" → "Marketing"
 *      "Department of Computer Science" → "Computer Science"
 */
export function inferDiscipline(affiliation: string, topicNames: string[]): string | null {
  // Try to extract from affiliation: "Professor of/in X", "Department of X"
  // Prefer position-based patterns (more reliable than institution-based)
  const positionPatterns = [
    /(?:professor|prof\.?)\s+(?:of|in|for)\s+(.+?)(?:\s*[,;]|$)/i,
    /(?:department|dept\.?)\s+(?:of|in)\s+(.+?)(?:\s*[,;]|$)/i,
  ];
  for (const pattern of positionPatterns) {
    const match = affiliation.match(pattern);
    if (match) {
      const field = match[1].trim().replace(/\s+at\s+.*$/i, '');
      // Reject if it looks like an institution name rather than a discipline
      if (field.length > 2 && field.length < 60 && !/\b(university|institute|college|school|center|centre|lab|studies)\b/i.test(field)) {
        return field;
      }
    }
  }
  // Fall back to first topic if it looks like a discipline (short, not too specific)
  if (topicNames.length > 0) {
    const first = topicNames[0];
    if (first.split(/\s+/).length <= 5) return first;
  }
  return null;
}
