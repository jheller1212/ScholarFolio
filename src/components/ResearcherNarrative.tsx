import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { FileText, TrendingUp, Users, BookOpen, Award, Flag, Loader2, Check, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logCaughtError } from '../lib/errorLogger';
import { useAuth } from '../contexts/AuthContext';
import { coAuthorsOf } from '../utils/authorIdentity';
import type { Author, CoAuthorGeoData, FieldNormalizedMetrics } from '../types/scholar';
import type { PIndexResult } from '../services/openalex/pindex';
import { findJournalRanking } from '../data/journalRankings';
import { normalizeVenueName } from '../utils/venue';
import { scholarService } from '../services/scholar';

interface ResearcherNarrativeProps {
  data: Author;
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null;
  onSearch?: (url: string) => void;
  pIndexResult?: PIndexResult | null;
}


function getCareerSpan(publications: Author['publications']): { firstYear: number; lastYear: number; years: number } {
  const currentYear = new Date().getFullYear();
  // Filter out garbage years: must be after 1950 and not in the future
  let years = publications.map(p => p.year).filter(y => y >= 1950 && y <= currentYear + 1);
  if (years.length === 0) return { firstYear: 0, lastYear: 0, years: 0 };

  // Remove statistical outliers on the early end (misattributed old publications).
  // Use IQR-based fence: if the earliest year(s) are far below Q1 - 1.5*IQR, drop them.
  if (years.length >= 5) {
    const sorted = [...years].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    years = years.filter(y => y >= lowerFence);
  }

  if (years.length === 0) return { firstYear: 0, lastYear: 0, years: 0 };
  const firstYear = years.reduce((a, b) => a < b ? a : b);
  const lastYear = years.reduce((a, b) => a > b ? a : b);
  return { firstYear, lastYear, years: lastYear - firstYear + 1 };
}

function getTopVenues(publications: Author['publications'], limit: number): { name: string; count: number }[] {
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

function getProductivityPhase(publications: Author['publications']): string {
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

function getMostCitedPaper(publications: Author['publications']): Author['publications'][0] | null {
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
function parseAffiliation(raw: string): { position: string; institution: string } {
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
// Module-level stop words set — constructed once, reused across calls
const THEME_STOP_WORDS = new Set([
    // Function words
    'the', 'a', 'an', 'of', 'in', 'on', 'for', 'and', 'or', 'to', 'with',
    'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has',
    'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'can', 'shall', 'not', 'no', 'but', 'if', 'at', 'as',
    'it', 'its', 'this', 'that', 'these', 'those', 'their', 'them', 'they',
    'we', 'our', 'how', 'what', 'which', 'who', 'whom', 'when', 'where',
    'why', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'than', 'too', 'very', 'also', 'just', 'about', 'above',
    'after', 'again', 'between', 'into', 'through', 'during', 'before',
    'via', 'under', 'over', 'upon', 'within', 'without', 'along', 'since',
    // Academic verbs/gerunds that aren't topics
    'using', 'based', 'exploring', 'examining', 'understanding', 'investigating',
    'analyzing', 'analysing', 'assessing', 'evaluating', 'measuring', 'testing',
    'comparing', 'developing', 'building', 'creating', 'designing', 'proposing',
    'presenting', 'showing', 'demonstrating', 'revealing', 'suggesting',
    'explaining', 'predicting', 'modeling', 'modelling', 'determining',
    'identifying', 'mapping', 'tracking', 'monitoring', 'implementing',
    'applying', 'adopting', 'integrating', 'combining', 'linking', 'bridging',
    'rethinking', 'reconsidering', 'revisiting', 'extending', 'expanding',
    'enhancing', 'improving', 'increasing', 'reducing', 'enabling', 'driving',
    'shaping', 'influencing', 'affecting', 'mediating', 'moderating',
    // Common academic nouns that are too generic
    'new', 'study', 'analysis', 'research', 'approach', 'role', 'effect',
    'effects', 'impact', 'case', 'evidence', 'towards', 'toward', 'among',
    'across', 'review', 'results', 'findings', 'implications', 'perspective',
    'perspectives', 'framework', 'model', 'models', 'theory', 'theories',
    'conceptual', 'empirical', 'systematic', 'comparative', 'critical',
    'introduction', 'editorial', 'commentary', 'response', 'reply', 'note',
    'chapter', 'paper', 'article', 'literature', 'future', 'directions',
    'special', 'issue', 'part', 'volume',
    // Common adjectives/adverbs that aren't topics
    'really', 'highly', 'fully', 'merely', 'largely', 'mainly', 'primarily',
    'particularly', 'especially', 'generally', 'currently', 'recently',
    'increasingly', 'different', 'various', 'several', 'multiple',
    'first', 'second', 'third', 'early', 'late', 'recent', 'current',
    'good', 'better', 'best', 'high', 'low', 'large', 'small', 'long', 'short',
    // Additional common title words that don't indicate topics
    'challenges', 'opportunities', 'strategies', 'practices', 'processes',
    'outcomes', 'determinants', 'antecedents', 'consequences', 'dynamics',
    'patterns', 'mechanisms', 'factors', 'dimensions', 'aspects',
    'definition', 'overview', 'agenda', 'assessment', 'exploration',
    'investigation', 'examination', 'discussion', 'considerations',
    'automated', 'automatic', 'semi-automated', 'manual',
    'local', 'national', 'international', 'regional',
    'potential', 'possible', 'proposed', 'alternative', 'traditional',
    'comprehensive', 'preliminary', 'initial', 'advanced', 'novel',
    'ethical', 'practical', 'theoretical', 'methodological',
    // Verbs and verb-like words that leak into bigrams
    'seeing', 'believing', 'making', 'taking', 'getting', 'going', 'looking',
    'working', 'thinking', 'knowing', 'finding', 'giving', 'telling', 'feeling',
    'becoming', 'keeping', 'leaving', 'putting', 'running', 'setting', 'turning',
    'bringing', 'holding', 'letting', 'beginning', 'seeming', 'helping', 'talking',
    'moving', 'living', 'playing', 'standing', 'losing', 'paying', 'meeting',
    'sitting', 'opening', 'growing', 'walking', 'winning', 'teaching', 'offering',
    'learning', 'considering', 'appearing', 'leading', 'rising', 'changing',
    'coming', 'reading', 'calling', 'following', 'adding', 'reaching', 'serving',
    'pulling', 'pushing', 'covering', 'cutting', 'crossing', 'breaking', 'passing',
    'raising', 'addressing', 'reporting', 'engaging', 'promoting', 'achieving',
    'supporting', 'providing', 'ensuring', 'delivering', 'stimulating', 'fostering',
    'leveraging', 'harnessing', 'unlocking', 'unleashing', 'overcoming',
    'navigating', 'transforming', 'disrupting', 'accelerating', 'redefining',
    'reimagining', 'uncovering', 'unraveling', 'unpacking', 'deconstructing',
    'drives', 'driven', 'matters',
    // Common adjective/noun fragments that aren't topics
    'curious', 'personal', 'reliability', 'gut', 'shop',
    'collected', 'papers', 'adventures', 'character', 'years',
    'vol', 'swiss', 'berlin',
    'real', 'world', 'open', 'key', 'big', 'end', 'old', 'age', 'set',
    'well', 'way', 'much', 'back', 'turn', 'look', 'take', 'make', 'give',
    'come', 'keep', 'let', 'say', 'get', 'got', 'put', 'run', 'see', 'seem',
    'need', 'try', 'ask', 'use', 'find', 'tell', 'call', 'play', 'work',
    'move', 'live', 'believe', 'bring', 'happen', 'write', 'provide', 'sit',
    'stand', 'lose', 'pay', 'meet', 'include', 'continue', 'learn', 'change',
    'lead', 'understand', 'watch', 'follow', 'stop', 'speak', 'read', 'add',
    'spend', 'grow', 'win', 'teach', 'show', 'hear', 'offer', 'remember',
    'consider', 'appear', 'love', 'buy', 'wait', 'die', 'send', 'expect',
    'build', 'stay', 'fall', 'reach', 'kill', 'remain', 'suggest', 'raise',
    'pass', 'sell', 'require', 'report', 'decide', 'pull',
    // Publication-type words
    'book', 'books', 'handbook', 'proceedings', 'conference', 'journal',
    'preprint', 'thesis', 'dissertation', 'monograph', 'manuscript',
    // Common non-English words that slip through (no diacritics)
    'der', 'die', 'das', 'und', 'ein', 'eine', 'einer', 'des', 'dem',
    'den', 'auf', 'aus', 'bei', 'mit', 'von', 'zum', 'zur', 'als',
    'les', 'des', 'une', 'dans', 'sur', 'par', 'pour', 'avec', 'aux',
    'het', 'een', 'van', 'voor', 'met', 'niet', 'dat', 'zij', 'ook',
    'wel', 'nog', 'maar', 'wat', 'hoe', 'wie', 'waar', 'naar', 'tot',
    'over', 'door', 'kan', 'moet', 'mag', 'zal', 'zou', 'hebben', 'zijn',
    'worden', 'deze', 'dit', 'die', 'ons', 'hun', 'uw', 'meer', 'veel',
    'alle', 'geen', 'elk', 'zo', 'dan', 'dus', 'want', 'omdat',
    'oude', 'dag', 'geld', 'financi', 'financieel', 'financiele',
    'veerkracht', 'pensioen', 'pensioenen', 'sparen', 'beleggen',
    'inkomen', 'schuld', 'schulden', 'huishouden', 'consument',
    'onderzoek', 'studie', 'rapport', 'bijdrage', 'effect', 'effecten',
    'zetten', 'mensen', 'geven', 'maken', 'nemen', 'doen', 'laten', 'zien',
    'werken', 'denken', 'weten', 'vinden', 'kopen', 'keuze', 'gedrag',
    'kinderen', 'jongeren', 'ouderen', 'vrouwen', 'mannen', 'klanten',
    'aan', 'actie', 'punt', 'recht', 'deel', 'plaats', 'tijd', 'jaar',
    'hulp', 'steun', 'weg', 'huis', 'land', 'stad', 'werk', 'leven',
    'zwischen', 'oder', 'aber', 'wenn', 'weil', 'nach', 'kann', 'wird',
    'sind', 'nicht', 'auch', 'noch', 'nur', 'sehr', 'schon', 'doch',
    'unter', 'gegen', 'durch', 'ohne', 'jede', 'alle', 'sein', 'meine',
    'ihre', 'seine', 'unser', 'wir', 'sie', 'sich',
    'theorie', 'antwort', 'briefe', 'sechzig', 'english', 'translation',
    'letter', 'jul', 'jan', 'feb', 'mar', 'apr', 'jun', 'aug', 'sep', 'oct', 'nov', 'dec',
]);

function extractTitleThemes(publications: Author['publications'], authorName?: string, fieldTopics?: string[]): string[] {
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
function inferResearchMethods(publications: Author['publications']): string[] {
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
function inferDiscipline(affiliation: string, topicNames: string[]): string | null {
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

export function generateNarrativeParagraphs(data: Author, pIndexResult?: PIndexResult | null): string[] {
    const { publications, metrics, topics, name, totalCitations } = data;
    const career = getCareerSpan(publications);
    const topVenues = getTopVenues(publications, 3);
    const phase = getProductivityPhase(publications);
    const topPaper = getMostCitedPaper(publications);

    // Build research areas text from topics (defensive: name may be object from SerpAPI)
    const topicNames = topics.map(t => {
      if (typeof t.name === 'object' && t.name !== null) {
        return (t.name as any).title || '';
      }
      return String(t.name || '');
    }).filter(Boolean).slice(0, 5);
    let topicsText = '';
    if (topicNames.length > 0) {
      if (topicNames.length === 1) {
        topicsText = topicNames[0];
      } else {
        topicsText = topicNames.slice(0, -1).join(', ') + ' and ' + topicNames[topicNames.length - 1];
      }
    }

    // Infer discipline for context
    const discipline = inferDiscipline(data.affiliation, topicNames);

    // Career overview paragraph
    const paragraphs: string[] = [];

    const { position, institution } = parseAffiliation(data.affiliation);
    let careerParagraph = `${name} is`;
    if (position) {
      // e.g. "is an Assistant Professor in Marketing at Maastricht University"
      const article = /^[aeiou]/i.test(position) ? ' an' : ' a';
      careerParagraph += `${article} ${position}`;
      if (institution) {
        careerParagraph += ` at ${institution}`;
      }
    } else if (institution) {
      // If we have a discipline, use it: "a Marketing researcher at..."
      if (discipline) {
        careerParagraph += ` a ${discipline} researcher at ${institution}`;
      } else {
        careerParagraph += ` a researcher at ${institution}`;
      }
    } else {
      careerParagraph += ' a researcher';
    }
    if (topicsText) {
      careerParagraph += `, working in the ${topicNames.length === 1 ? 'area' : 'areas'} of ${topicsText}`;
    }
    careerParagraph += '.';

    // Extract last name for natural pronoun alternation
    // Handle comma-inverted names like "García López, José" → "García López"
    // Preserve surname prefixes: de, van, von, di, la, el, al, etc.
    const SURNAME_PREFIXES = new Set(['de', 'van', 'von', 'di', 'da', 'del', 'della', 'la', 'le', 'el', 'al', 'bin', 'ben', 'ter', 'ten', 'den', 'der']);
    let lastName: string;
    if (name.includes(',')) {
      lastName = name.split(',')[0].trim().split(/\s+/).pop() || name;
    } else {
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length > 2) {
        // Find where the surname starts (first prefix before the last word)
        let surnameStart = nameParts.length - 1;
        for (let i = nameParts.length - 2; i >= 1; i--) {
          if (SURNAME_PREFIXES.has(nameParts[i].toLowerCase())) {
            surnameStart = i;
          } else {
            break;
          }
        }
        lastName = nameParts.slice(surnameStart).join(' ');
      } else {
        lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : name;
      }
    }

    // Dutch naming convention: capitalize prefix at sentence start (e.g. "van Roekel" → "Van Roekel")
    const lastNameCap = lastName.charAt(0).toUpperCase() + lastName.slice(1);

    if (career.firstYear > 0) {
      if (career.years <= 2) {
        careerParagraph += ` ${lastNameCap}'s first indexed publication appeared in **${career.firstYear}**.`;
      } else {
        careerParagraph += ` ${lastNameCap}'s publication record spans **${career.years}** years, from ${career.firstYear} to ${career.lastYear}.`;
      }
    }

    // Infer research methods from publication titles
    const methods = inferResearchMethods(publications);
    if (methods.length > 0) {
      let methodsText: string;
      if (methods.length === 1) {
        methodsText = methods[0];
      } else {
        methodsText = methods.slice(0, -1).join(', ') + ' and ' + methods[methods.length - 1];
      }
      careerParagraph += ` Based on publication titles, ${lastNameCap}'s work draws on ${methodsText}.`;
    }

    paragraphs.push(careerParagraph);

    // Impact paragraph
    let impactParagraph = '';
    if (totalCitations === 0 && publications.length <= 3) {
      impactParagraph = `${lastNameCap} has **${publications.length}** indexed publication${publications.length !== 1 ? 's' : ''} and has not yet accumulated citations in Google Scholar.`;
    } else if (totalCitations === 0) {
      impactParagraph = `${lastNameCap} has published **${publications.length}** work${publications.length !== 1 ? 's' : ''} but has not yet accumulated citations in Google Scholar.`;
    } else {
      impactParagraph = `Over the course of their career, ${lastNameCap} has published **${publications.length}** work${publications.length !== 1 ? 's' : ''} and accumulated **${totalCitations.toLocaleString()}** citation${totalCitations !== 1 ? 's' : ''}, yielding an h-index of **${metrics.hIndex}**`;
      if (metrics.i10Index > 0) {
        impactParagraph += ` and an i10-index of **${metrics.i10Index}** (${metrics.i10Index} publication${metrics.i10Index !== 1 ? 's' : ''} with 10 or more citations)`;
      }
      impactParagraph += '.';

      if (topPaper && topPaper.citations > 0) {
        impactParagraph += ` Their most cited work, "${topPaper.title}", has received **${topPaper.citations.toLocaleString()}** citation${topPaper.citations !== 1 ? 's' : ''}.`;
      }
    }
    paragraphs.push(impactParagraph);

    // Productivity & trend paragraph — with specific publication rate numbers
    const currentYear = new Date().getFullYear();
    const recentYearPubs = publications.filter(p => p.year >= currentYear - 3 && p.year <= currentYear);
    const olderYearPubs = publications.filter(p => p.year >= currentYear - 6 && p.year < currentYear - 3);
    const recentRate = recentYearPubs.length > 0 ? (recentYearPubs.length / 3).toFixed(1) : '0';
    const olderRate = olderYearPubs.length > 0 ? (olderYearPubs.length / 3).toFixed(1) : '0';

    let trendParagraph = '';
    if (phase === 'accelerating') {
      trendParagraph = `${lastNameCap}'s publication output has been accelerating, averaging **${recentRate}** publications per year recently compared to **${olderRate}** in the preceding period.`;
    } else if (phase === 'steady') {
      trendParagraph = `${lastNameCap} maintains a steady publication pace of approximately **${recentRate}** publications per year, indicating a sustained and active research program.`;
    } else if (phase === 'decelerating') {
      trendParagraph = `${lastNameCap}'s recent publication rate has slowed to **${recentRate}** per year, compared to **${olderRate}** in the preceding three-year period.`;
    } else if (phase === 'emerging') {
      trendParagraph = `${lastNameCap} appears to be in the early stages of their publication career.`;
    } else if (phase === 'inactive') {
      trendParagraph = 'There are no publications in the most recent three years in the indexed record.';
    }

    if (Math.abs(metrics.citationGrowthRate) >= 2) {
      const growthDirection = metrics.citationGrowthRate > 0 ? 'growing' : 'declining';
      trendParagraph += ` Citations have been ${growthDirection} at an average rate of ${Math.abs(metrics.citationGrowthRate)}% per year over the last three complete years.`;
    } else if (metrics.citationGrowthRate !== 0 && totalCitations > 0) {
      trendParagraph += ' Citation rates have remained relatively stable in recent years.';
    }
    if (trendParagraph) paragraphs.push(trendParagraph);

    // Research evolution paragraph — compare early vs recent title themes
    if (career.years >= 4 && publications.length >= 6) {
      const sorted = [...publications].sort((a, b) => a.year - b.year);
      const midpoint = Math.floor(sorted.length / 2);
      const earlyPubs = sorted.slice(0, midpoint);
      const recentPubs = sorted.slice(midpoint);

      const fieldLabels = topicNames.length > 0 ? topicNames : undefined;
      const earlyThemes = extractTitleThemes(earlyPubs, name, fieldLabels);
      const recentThemes = extractTitleThemes(recentPubs, name, fieldLabels);

      // Find themes unique to each period (not in the other's top themes)
      const earlySet = new Set(earlyThemes);
      const recentSet = new Set(recentThemes);
      const earlyOnly = earlyThemes.filter(t => !recentSet.has(t)).slice(0, 3);
      const recentOnly = recentThemes.filter(t => !earlySet.has(t)).slice(0, 3);

      const formatList = (items: string[]) => {
        if (items.length === 1) return items[0];
        return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
      };

      // Only include evolution paragraph if we have at least 2 good themes per period
      if (earlyOnly.length >= 2 && recentOnly.length >= 2) {
        paragraphs.push(
          `${lastNameCap}'s earlier work focused on topics such as ${formatList(earlyOnly)}, while more recent publications have shifted towards ${formatList(recentOnly)}.`
        );
      } else if (earlyOnly.length > 0 && recentOnly.length > 0) {
        paragraphs.push(
          `${lastNameCap}'s earlier work focused on topics such as ${formatList(earlyOnly)}, while more recent publications have shifted towards ${formatList(recentOnly)}.`
        );
      } else if (recentOnly.length > 0) {
        paragraphs.push(
          `${lastNameCap}'s recent work has increasingly focused on ${formatList(recentOnly)}.`
        );
      } else if (earlyThemes.length > 0 && recentThemes.length > 0) {
        const shared = earlyThemes.filter(t => recentSet.has(t)).slice(0, 3);
        if (shared.length > 0) {
          paragraphs.push(
            `Throughout their career, ${lastNameCap}'s research has consistently centered on ${formatList(shared)}.`
          );
        }
      }
    }

    // Collaboration paragraph
    let collabParagraph = '';
    if (metrics.collaborationScore > 0) {
      let collabPct: string;
      if (metrics.collaborationScore === 100) {
        collabPct = 'All';
      } else if (metrics.collaborationScore >= 95) {
        collabPct = 'Nearly all';
      } else if (metrics.collaborationScore >= 75) {
        collabPct = `The majority (${metrics.collaborationScore}%)`;
      } else if (metrics.collaborationScore >= 50) {
        collabPct = `About half (${metrics.collaborationScore}%)`;
      } else if (metrics.collaborationScore >= 10) {
        collabPct = `A smaller share (${metrics.collaborationScore}%)`;
      } else {
        collabPct = `A small fraction (${metrics.collaborationScore}%)`;
      }
      collabParagraph = `${collabPct} of ${lastNameCap}'s publications are co-authored, with an average of **${metrics.averageAuthors}** authors per paper across **${metrics.totalCoAuthors}** unique co-author${metrics.totalCoAuthors !== 1 ? 's' : ''}.`;
      if (metrics.topCoAuthor && metrics.topCoAuthorPapers >= 2) {
        collabParagraph += ` ${lastNameCap}'s most frequent collaborator is ${metrics.topCoAuthor}, with whom they have co-authored **${metrics.topCoAuthorPapers}** publication${metrics.topCoAuthorPapers !== 1 ? 's' : ''}.`;
      }
      const otherCoAuthors = (metrics.topCoAuthors ?? [])
        .slice(1) // skip #1 (already mentioned above)
        .filter(a => a.papers >= 2);
      if (otherCoAuthors.length > 0) {
        const names = otherCoAuthors.map(a => `${a.name} (${a.papers})`);
        const last = names.pop()!;
        const list = names.length > 0 ? `${names.join(', ')}, and ${last}` : last;
        collabParagraph += ` Other frequent co-authors include ${list}.`;
      }
      paragraphs.push(collabParagraph);
    } else if (publications.length > 0) {
      paragraphs.push('All indexed publications are single-authored.');
    }

    // Venues paragraph
    if (topVenues.length > 0) {
      const venueList = topVenues.map(v => `${v.name} (${v.count} publication${v.count !== 1 ? 's' : ''})`);
      let venuesParagraph = topVenues.length === 1
        ? `${lastNameCap}'s most frequent publication outlet is `
        : `${lastNameCap}'s most frequent publication outlets include `;
      if (venueList.length === 1) {
        venuesParagraph += venueList[0];
      } else {
        venuesParagraph += venueList.slice(0, -1).join(', ') + ' and ' + venueList[venueList.length - 1];
      }
      venuesParagraph += '.';
      paragraphs.push(venuesParagraph);
    }

    // P-index paragraph (only when result is available)
    if (pIndexResult && (pIndexResult.rawPIndex !== null || pIndexResult.owpiPIndex !== null)) {
      const rawVal = pIndexResult.rawPIndex !== null ? `**${pIndexResult.rawPIndex}**` : 'N/A';
      const owpiVal = pIndexResult.owpiPIndex !== null ? `**${pIndexResult.owpiPIndex}**` : 'N/A';
      paragraphs.push(
        `Based on OpenAlex data, ${lastNameCap} achieves a p-index of ${rawVal} (average citation percentile within journal and year), with an authorship-weighted p-index of ${owpiVal}.`
      );
    }

    return paragraphs;
}

function generateOpenAccessParagraph(data: Author): string | null {
  const oa = data.openAccess;
  if (!oa || oa.total === 0) return null;

  let pctLabel: string;
  if (oa.oaPercent >= 90) pctLabel = 'Nearly all';
  else if (oa.oaPercent >= 70) pctLabel = `A large majority (${oa.oaPercent}%)`;
  else if (oa.oaPercent >= 50) pctLabel = `Over half (${oa.oaPercent}%)`;
  else if (oa.oaPercent >= 30) pctLabel = `About a third (${oa.oaPercent}%)`;
  else if (oa.oaPercent >= 10) pctLabel = `A smaller share (${oa.oaPercent}%)`;
  else pctLabel = `A small fraction (${oa.oaPercent}%)`;

  let paragraph = `${pctLabel} of their indexed publications are openly accessible.`;

  // Add breakdown if there's meaningful variety
  const parts: string[] = [];
  if (oa.gold > 0) parts.push(`${oa.gold} gold`);
  if (oa.green > 0) parts.push(`${oa.green} green`);
  if (oa.hybrid > 0) parts.push(`${oa.hybrid} hybrid`);
  if (oa.bronze > 0) parts.push(`${oa.bronze} bronze`);

  if (parts.length > 1) {
    paragraph += ` This includes ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} open access publications.`;
  }

  // Analyze OA trend over time
  if (oa.publicationOa && data.publications.length > 0) {
    const yearMap: Record<number, { total: number; oa: number }> = {};
    for (const pub of data.publications) {
      if (pub.year <= 0) continue;
      const normalized = pub.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const oaInfo = oa.publicationOa[normalized];
      if (!yearMap[pub.year]) yearMap[pub.year] = { total: 0, oa: 0 };
      yearMap[pub.year].total++;
      if (oaInfo && oaInfo.status !== 'closed') yearMap[pub.year].oa++;
    }

    const years = Object.entries(yearMap)
      .map(([y, d]) => ({ year: parseInt(y), pct: d.total > 0 ? d.oa / d.total : 0 }))
      .filter(d => d.year > 0)
      .sort((a, b) => a.year - b.year);

    if (years.length >= 4) {
      const half = Math.floor(years.length / 2);
      const earlyAvg = years.slice(0, half).reduce((s, d) => s + d.pct, 0) / half;
      const lateAvg = years.slice(half).reduce((s, d) => s + d.pct, 0) / (years.length - half);
      const diff = lateAvg - earlyAvg;

      if (diff > 0.15) {
        paragraph += ` There is a notable trend toward increased open access publishing in recent years.`;
      } else if (diff > 0.05) {
        paragraph += ` Open access publishing has been gradually increasing over their career.`;
      } else if (diff < -0.15) {
        paragraph += ` Interestingly, the share of open access publications has decreased in recent years.`;
      } else {
        paragraph += ` The proportion of open access publications has remained relatively stable over time.`;
      }
    }
  }

  return paragraph;
}

function generateFieldMetricsParagraph(fieldMetrics?: FieldNormalizedMetrics | null): string | null {
  if (!fieldMetrics) return null;
  const parts: string[] = [];

  if (fieldMetrics.fwci !== null) {
    const fwci = fieldMetrics.fwci.toFixed(2);
    const meanSuffix = fieldMetrics.fwciMean !== null ? ` (mean: ${fieldMetrics.fwciMean.toFixed(2)})` : '';
    if (fieldMetrics.fwci >= 1.0) {
      parts.push(`Their median Field-Weighted Citation Impact (FWCI) is ${fwci}${meanSuffix}, meaning a typical publication of theirs receives ${fwci} times the world-average citations for its field, year, and publication type.`);
    } else {
      parts.push(`Their median Field-Weighted Citation Impact (FWCI) is ${fwci}${meanSuffix}, relative to the world average of 1.00 for their field, year, and publication type.`);
    }
  }

  if (fieldMetrics.topDecileShare !== null) {
    parts.push(`${fieldMetrics.topDecileShare}% of their publications rank among the top 10% most-cited papers in their field (world baseline: 10%).`);
  }

  if (fieldMetrics.meanCitedness !== null) {
    parts.push(`The mean journal impact of their publication outlets is ${fieldMetrics.meanCitedness.toFixed(2)}.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

function generateGeoParagraph(geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null): string | null {
  if (!geoData || geoData.coAuthors.length === 0) return null;

  const countries = new Set(geoData.coAuthors.map(a => a.countryCode));
  const countryCount = countries.size;
  if (countryCount === 0) return null;

  // Build country → co-author count map
  const countryNames = new Map<string, number>();
  for (const a of geoData.coAuthors) {
    // Use institution country as a rough label
    const key = a.countryCode;
    countryNames.set(key, (countryNames.get(key) || 0) + 1);
  }

  // Map continent
  const continentMap: Record<string, string> = {
    US: 'North America', CA: 'North America', MX: 'North America',
    BR: 'South America', AR: 'South America', CL: 'South America', CO: 'South America', PE: 'South America',
    GB: 'Europe', DE: 'Europe', FR: 'Europe', NL: 'Europe', IT: 'Europe', ES: 'Europe', SE: 'Europe',
    NO: 'Europe', DK: 'Europe', FI: 'Europe', BE: 'Europe', CH: 'Europe', AT: 'Europe', PT: 'Europe',
    IE: 'Europe', PL: 'Europe', CZ: 'Europe', HU: 'Europe', RO: 'Europe', GR: 'Europe', HR: 'Europe',
    SI: 'Europe', SK: 'Europe', BG: 'Europe', LT: 'Europe', LV: 'Europe', EE: 'Europe', LU: 'Europe',
    CN: 'Asia', JP: 'Asia', KR: 'Asia', IN: 'Asia', SG: 'Asia', TW: 'Asia', HK: 'Asia',
    TH: 'Asia', MY: 'Asia', ID: 'Asia', PH: 'Asia', VN: 'Asia', PK: 'Asia', IL: 'Asia',
    TR: 'Asia', SA: 'Asia', AE: 'Asia', QA: 'Asia',
    AU: 'Oceania', NZ: 'Oceania',
    ZA: 'Africa', NG: 'Africa', KE: 'Africa', EG: 'Africa', MA: 'Africa', GH: 'Africa', ET: 'Africa',
  };
  const continents = new Set<string>();
  for (const code of countries) {
    const continent = continentMap[code] || 'other';
    if (continent !== 'other') continents.add(continent);
  }

  let scope: string;
  if (countryCount >= 10) scope = 'an extensive';
  else if (countryCount >= 5) scope = 'a broad';
  else if (countryCount >= 3) scope = 'a moderate';
  else scope = 'a limited';

  let paragraph = `Their co-authors span ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`;
  if (continents.size > 1) {
    paragraph += ` across ${continents.size} continents`;
  }
  paragraph += `, reflecting ${scope} international collaboration network.`;

  return paragraph;
}

function generateCitationDistributionParagraph(metrics: Author['metrics'], totalCitations: number): string | null {
  if (totalCitations === 0) return null;
  const parts: string[] = [];

  if (metrics.citationGini > 0) {
    let giniDesc: string;
    if (metrics.citationGini >= 0.8) giniDesc = 'highly concentrated among a few key papers';
    else if (metrics.citationGini >= 0.6) giniDesc = 'moderately concentrated';
    else if (metrics.citationGini >= 0.4) giniDesc = 'moderately spread across publications';
    else giniDesc = 'relatively evenly distributed across publications';
    parts.push(`Their citation Gini coefficient of ${metrics.citationGini.toFixed(2)} indicates that citations are ${giniDesc}.`);
  }

  if (metrics.citationHalfLife > 0 && metrics.citationHalfLife < 100) {
    parts.push(`The citation half-life is ${metrics.citationHalfLife} year${metrics.citationHalfLife !== 1 ? 's' : ''}, meaning half of all citations were received within ${metrics.citationHalfLife} year${metrics.citationHalfLife !== 1 ? 's' : ''} of publication.`);
  }

  if (metrics.ageNormalizedRate > 0) {
    parts.push(`Age-normalized, they receive approximately ${metrics.ageNormalizedRate} citation${metrics.ageNormalizedRate !== 1 ? 's' : ''} per career year.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

export function ResearcherNarrative({ data, geoData, onSearch, pIndexResult }: ResearcherNarrativeProps) {
  const narrative = useMemo(() => generateNarrativeParagraphs(data, pIndexResult), [data, pIndexResult]);
  const oaParagraph = useMemo(() => generateOpenAccessParagraph(data), [data]);
  const fieldMetricsParagraph = useMemo(() => generateFieldMetricsParagraph(data.fieldMetrics), [data.fieldMetrics]);
  const geoParagraph = useMemo(() => generateGeoParagraph(geoData), [geoData]);
  const citationDistParagraph = useMemo(() => generateCitationDistributionParagraph(data.metrics, data.totalCitations), [data.metrics, data.totalCitations]);
  const { refreshCredits } = useAuth();
  const [showReport, setShowReport] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<
    { creditsGranted: number; signedIn: boolean; emailLeft: boolean } | null
  >(null);

  const scholarId = new URLSearchParams(window.location.search).get('user')
    || window.location.pathname.replace(/^\//, '').replace(/\/$/, '')
    || '';

  // Collect all co-author names for linkification
  const coAuthorNames = useMemo(() => {
    const names = new Set<string>();
    for (const pub of data.publications) {
      // Owner variants (maiden name, umlaut spellings, extra initials) must
      // not be linkified as if they were other researchers.
      for (const author of coAuthorsOf(pub.authors, data.name)) {
        names.add(author.trim());
      }
    }
    return names;
  }, [data.publications, data.name]);

  const [searchingAuthor, setSearchingAuthor] = useState<string | null>(null);

  const handleAuthorClick = useCallback(async (authorName: string) => {
    if (searchingAuthor) return;
    setSearchingAuthor(authorName);
    // Open window immediately during user click to avoid popup blocker
    const newWindow = window.open('about:blank', '_blank');
    if (newWindow) {
      newWindow.document.write(`<!DOCTYPE html><html><head><title>Scholar Folio</title><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafa;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#334155}
        .wrap{text-align:center}
        .spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#2d7d7d;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .title{font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px}
        .sub{font-size:13px;color:#64748b}
      </style></head><body><div class="wrap"><div class="spinner"></div><div class="title">Loading profile</div><div class="sub">${authorName.replace(/'/g, '&#39;')}</div></div></body></html>`);
      newWindow.document.close();
    }
    try {
      const results = await scholarService.searchAuthors(authorName);
      if (results.length >= 1 && newWindow) {
        newWindow.location.href = `${window.location.origin}/scholar/${encodeURIComponent(results[0].authorId)}`;
      } else {
        newWindow?.close();
      }
    } catch (err) {
      logCaughtError(err, 'profile', 'ResearcherNarrative', 'author-link-search', { authorName });
      newWindow?.close();
    } finally {
      setSearchingAuthor(null);
    }
  }, [searchingAuthor]);

  /** Replace known co-author names in text with clickable buttons */
  const linkifyText = useCallback((text: string): React.ReactNode => {
    if (!onSearch || coAuthorNames.size === 0) return text;

    // Find co-author names that appear in this text
    const matches: { name: string; start: number; end: number }[] = [];
    for (const name of coAuthorNames) {
      let idx = text.indexOf(name);
      while (idx !== -1) {
        matches.push({ name, start: idx, end: idx + name.length });
        idx = text.indexOf(name, idx + name.length);
      }
    }
    if (matches.length === 0) return text;

    // Sort by position and remove overlaps
    matches.sort((a, b) => a.start - b.start);
    const filtered: typeof matches = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        filtered.push(m);
        lastEnd = m.end;
      }
    }

    // Build JSX fragments
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (const m of filtered) {
      if (m.start > cursor) {
        parts.push(text.slice(cursor, m.start));
      }
      const authorName = m.name;
      parts.push(
        <button
          key={`${m.start}-${authorName}`}
          onClick={() => handleAuthorClick(authorName)}
          className="text-[#2d7d7d] hover:text-[#1f5c5c] hover:underline transition-colors cursor-pointer inline"
          title={`View ${authorName}'s profile on ScholarFolio`}
        >
          {searchingAuthor === authorName ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin inline" />
              {authorName}
            </span>
          ) : authorName}
        </button>
      );
      cursor = m.end;
    }
    if (cursor < text.length) {
      parts.push(text.slice(cursor));
    }
    return <>{parts}</>;
  }, [coAuthorNames, onSearch, handleAuthorClick, searchingAuthor]);

  const handleReport = async () => {
    if (!reportMsg.trim()) return;
    setReportStatus('sending');
    setReportError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            authorId: scholarId,
            authorName: data.name,
            reporterEmail: reportEmail.trim() || null,
            message: reportMsg.trim(),
            pageUrl: window.location.href,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not send your report.');
      setReportResult({
        creditsGranted: body.creditsGranted ?? 0,
        signedIn: Boolean(body.signedIn),
        emailLeft: Boolean(reportEmail.trim()),
      });
      // Credits land server-side; refresh the header so the new balance shows.
      if (body.creditsGranted > 0) refreshCredits();
      setReportStatus('sent');
    } catch (err) {
      logCaughtError(err, 'profile', 'ResearcherNarrative', 'submit-report');
      setReportError(err instanceof Error ? err.message : 'Could not send your report.');
      setReportStatus('idle');
    }
  };

  const closeReport = () => {
    setShowReport(false);
    setReportMsg('');
    setReportEmail('');
    setReportError(null);
    setReportResult(null);
    setReportStatus('idle');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <FileText className="h-4 w-4 text-[#2d7d7d] mr-2" />
          Research Profile
        </h3>
        <button
          onClick={() => (showReport ? closeReport() : setShowReport(true))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:border-amber-400 transition-colors"
          title="Report an error in this profile — you'll get 3 credits as thanks"
        >
          <Flag className="h-3.5 w-3.5" />
          Report an error
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">+3 credits</span>
        </button>
      </div>

      {showReport && (
        <div className="mb-4 bg-gray-50 dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          {reportStatus === 'sent' && reportResult ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <p>
                    <strong className="text-gray-900 dark:text-gray-100">Sorry about that — and thank you.</strong>{' '}
                    Wrong data on your own profile is genuinely annoying, and reports like
                    yours are how we find these problems.
                  </p>
                  {reportResult.creditsGranted > 0 ? (
                    <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                      We've added {reportResult.creditsGranted} free credits to your account right away.
                    </p>
                  ) : reportResult.signedIn ? (
                    <p className="text-gray-500 dark:text-gray-400">
                      You've already received the maximum thank-you credits — the report still helps just as much.
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">
                      Create a free account and future reports earn you 3 credits each.
                    </p>
                  )}
                  <p>
                    {reportResult.emailLeft
                      ? "We'll follow up by email once we've looked into it."
                      : 'We review every report. Next time you can leave an email if you\'d like a reply.'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeReport}
                className="ml-6 px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">
                Spotted something wrong? Tell us and we'll fix it —{' '}
                <strong className="text-amber-700 dark:text-amber-400">you'll get 3 credits straight away</strong> as thanks.
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                Most common problems: a co-author who is actually you under another
                spelling (maiden name, umlaut, or extra initials), an open-access
                percentage that looks too low, a wrong affiliation, or missing or
                duplicated publications.
              </p>
              <textarea
                value={reportMsg}
                onChange={e => setReportMsg(e.target.value)}
                placeholder="Describe the error — e.g. 'my top co-author is my own maiden name' or 'most of my papers are open access but it shows 0%'"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none resize-none mb-2"
                maxLength={1000}
              />
              <input
                type="email"
                value={reportEmail}
                onChange={e => setReportEmail(e.target.value)}
                placeholder="Your email (optional — so we can tell you when it's fixed)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none mb-2"
              />
              {reportError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-2">
                  {reportError}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReport}
                  disabled={!reportMsg.trim() || reportStatus === 'sending'}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg disabled:opacity-50 transition-colors"
                >
                  {reportStatus === 'sending' ? (
                    <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Sending...</span>
                  ) : 'Submit report'}
                </button>
                <button
                  onClick={closeReport}
                  className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <NarrativeBody
        narrative={narrative}
        extras={[fieldMetricsParagraph, citationDistParagraph, geoParagraph, oaParagraph]}
        linkifyText={linkifyText}
        authorName={data.name}
      />
    </div>
  );
}

/** Animated narrative body — typewriter on first render, instant on revisit */
function NarrativeBody({
  narrative,
  extras,
  linkifyText,
  authorName,
}: {
  narrative: string[];
  extras: (React.ReactNode | null | undefined)[];
  linkifyText: (text: string) => React.ReactNode;
  authorName: string;
}) {
  // Track which author narratives have already been animated this session
  const animatedRef = useRef(false);
  const [revealedChars, setRevealedChars] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build flat text for character counting
  const allParagraphs = useMemo(() => {
    const texts = [...narrative];
    // extras are ReactNodes — we skip them for typewriter (they appear after)
    return texts;
  }, [narrative]);

  const totalChars = useMemo(() => allParagraphs.reduce((sum, p) => sum + p.replace(/\*\*/g, '').length, 0), [allParagraphs]);

  // Animate on first mount for this author
  useEffect(() => {
    if (animatedRef.current || totalChars === 0) {
      setRevealedChars(null); // null = show all
      return;
    }
    animatedRef.current = true;
    setRevealedChars(0);

    const duration = Math.min(5000, Math.max(3000, totalChars * 8));
    const charsPerFrame = totalChars / (duration / 16);
    let current = 0;

    const frame = () => {
      current += charsPerFrame;
      if (current >= totalChars) {
        setRevealedChars(null);
        return;
      }
      setRevealedChars(Math.floor(current));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [authorName, totalChars]);

  // Allow clicking to skip animation
  const skipAnimation = useCallback(() => {
    setRevealedChars(null);
  }, []);

  const isAnimating = revealedChars !== null;

  // Render paragraphs with character-level reveal
  function renderParagraphs() {
    if (!isAnimating) {
      // Show everything instantly
      return (
        <>
          {allParagraphs.map((paragraph, i) => (
            <p key={i}>
              {paragraph.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                j % 2 === 1
                  ? <strong key={j} className="font-semibold text-gray-900 dark:text-gray-100">{part}</strong>
                  : linkifyText(part)
              )}
            </p>
          ))}
          {extras.map((extra, i) => extra ? <p key={`e${i}`}>{extra}</p> : null)}
        </>
      );
    }

    // Typewriter mode: reveal characters across paragraphs
    let charsLeft = revealedChars!;
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < allParagraphs.length; i++) {
      const raw = allParagraphs[i];
      const plainText = raw.replace(/\*\*/g, '');

      if (charsLeft <= 0) break;

      const visibleCount = Math.min(charsLeft, plainText.length);
      charsLeft -= visibleCount;

      // We need to slice the original markdown-formatted text respecting bold markers
      const parts = raw.split(/\*\*(.*?)\*\*/g);
      let charBudget = visibleCount;
      const rendered: React.ReactNode[] = [];

      for (let j = 0; j < parts.length; j++) {
        if (charBudget <= 0) break;
        const part = parts[j];
        const slice = part.slice(0, charBudget);
        charBudget -= slice.length;

        if (j % 2 === 1) {
          rendered.push(<strong key={j} className="font-semibold text-gray-900 dark:text-gray-100">{slice}</strong>);
        } else {
          rendered.push(<span key={j}>{slice}</span>);
        }
      }

      elements.push(<p key={i}>{rendered}</p>);
    }

    return <>{elements}</>;
  }

  return (
    <div
      ref={containerRef}
      className="space-y-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
      onClick={isAnimating ? skipAnimation : undefined}
      style={isAnimating ? { cursor: 'pointer' } : undefined}
    >
      {renderParagraphs()}
      {isAnimating && (
        <span className="inline-block w-0.5 h-4 bg-[#2d7d7d] animate-pulse align-text-bottom ml-0.5" />
      )}
      {isAnimating && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 italic">Click anywhere to skip animation</p>
      )}
    </div>
  );
}

// Re-export text-only versions for PDF export
export const generateFieldMetricsParagraphText = generateFieldMetricsParagraph;
export const generateGeoParagraphText = generateGeoParagraph;
export const generateCitationDistributionParagraphText = generateCitationDistributionParagraph;
export const generateOpenAccessParagraphText = generateOpenAccessParagraph;
