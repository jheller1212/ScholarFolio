import React, { useMemo, useState, useCallback } from 'react';
import { FileText, TrendingUp, Users, BookOpen, Award, Flag, Loader2, Check, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Author, CoAuthorGeoData, FieldNormalizedMetrics } from '../types/scholar';
import { findJournalRanking } from '../data/journalRankings';
import { scholarService } from '../services/scholar';

interface ResearcherNarrativeProps {
  data: Author;
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null;
  onSearch?: (url: string) => void;
}

function getCareerSpan(publications: Author['publications']): { firstYear: number; lastYear: number; years: number } {
  const years = publications.map(p => p.year).filter(y => y > 0);
  if (years.length === 0) return { firstYear: 0, lastYear: 0, years: 0 };
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
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
        .trim();
      if (baseName.length > 0) {
        const key = baseName.toLowerCase();
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
      const prestigeDiff = prestigeScore(b.displayName) - prestigeScore(a.displayName);
      if (prestigeDiff !== 0) return prestigeDiff;
      return b.count - a.count; // Fall back to publication count
    })
    .slice(0, limit)
    .map(v => ({ name: v.displayName, count: v.count }));
}

function getProductivityPhase(publications: Author['publications']): string {
  const currentYear = new Date().getFullYear();
  const recentPubs = publications.filter(p => p.year >= currentYear - 3).length;
  const olderPubs = publications.filter(p => p.year >= currentYear - 6 && p.year < currentYear - 3).length;

  if (recentPubs === 0) return 'inactive';
  if (olderPubs === 0) return 'emerging';
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
function extractTitleThemes(publications: Author['publications']): string[] {
  // Stop words: function words + common academic verbs/fillers that aren't real topics
  const stopWords = new Set([
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
  ]);

  const bigramCounts = new Map<string, number>();

  for (const pub of publications) {
    const words = pub.title.toLowerCase()
      .replace(/[^a-z\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Count meaningful bigrams (these are the best topic indicators)
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
    }
    // Single words only if they are strong domain terms (≥6 chars, appear ≥3 times)
    for (const w of words) {
      if (w.length >= 6) {
        bigramCounts.set(w, (bigramCounts.get(w) || 0) + 1);
      }
    }
  }

  // Return themes that appear frequently, strongly preferring bigrams.
  // Bigrams need ≥2 occurrences, single words need ≥3 to qualify.
  const sorted = Array.from(bigramCounts.entries())
    .filter(([term, count]) => term.includes(' ') ? count >= 2 : count >= 3)
    .sort((a, b) => {
      // Prefer bigrams over single words at same frequency
      const aIsBigram = a[0].includes(' ') ? 1 : 0;
      const bIsBigram = b[0].includes(' ') ? 1 : 0;
      if (b[1] !== a[1]) return b[1] - a[1];
      return bIsBigram - aIsBigram;
    });

  const selected: string[] = [];
  for (const [term] of sorted) {
    if (selected.length >= 8) break;
    // If this is a single word, skip it if it's already covered by a selected bigram
    if (!term.includes(' ')) {
      const coveredByBigram = selected.some(s => s.includes(' ') && s.split(' ').includes(term));
      if (coveredByBigram) continue;
    }
    // If this is a bigram, remove any previously selected single words it contains
    if (term.includes(' ')) {
      const parts = term.split(' ');
      for (let i = selected.length - 1; i >= 0; i--) {
        if (!selected[i].includes(' ') && parts.includes(selected[i])) {
          selected.splice(i, 1);
        }
      }
    }
    selected.push(term);
  }
  return selected;
}

/** Infer research methods/approaches from publication titles. */
function inferResearchMethods(publications: Author['publications']): string[] {
  const titleCorpus = publications.map(p => p.title.toLowerCase()).join(' ');

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
    [/\bstructural equation|(?:^|\b)sem\b/, 'structural equation modeling'],
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

export function generateNarrativeParagraphs(data: Author): string[] {
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
      careerParagraph += ` a researcher at ${institution}`;
    } else {
      careerParagraph += ' a researcher';
    }
    if (topicsText) {
      careerParagraph += `, working in the ${topicNames.length === 1 ? 'area' : 'areas'} of ${topicsText}`;
    }
    careerParagraph += '.';

    if (career.firstYear > 0) {
      if (career.years <= 2) {
        careerParagraph += ` Their first indexed publication appeared in ${career.firstYear}.`;
      } else {
        careerParagraph += ` Their publication record spans ${career.years} years, from ${career.firstYear} to ${career.lastYear}.`;
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
      careerParagraph += ` Based on their publication titles, their work draws on ${methodsText}.`;
    }

    paragraphs.push(careerParagraph);

    // Impact paragraph
    let impactParagraph = '';
    if (totalCitations === 0 && publications.length <= 3) {
      impactParagraph = `They have ${publications.length} indexed publication${publications.length !== 1 ? 's' : ''} and have not yet accumulated citations in Google Scholar.`;
    } else if (totalCitations === 0) {
      impactParagraph = `They have published ${publications.length} work${publications.length !== 1 ? 's' : ''} but have not yet accumulated citations in Google Scholar.`;
    } else {
      impactParagraph = `Over the course of their career, they have published ${publications.length} work${publications.length !== 1 ? 's' : ''} and accumulated ${totalCitations.toLocaleString()} citation${totalCitations !== 1 ? 's' : ''}, yielding an h-index of ${metrics.hIndex}`;
      if (metrics.i10Index > 0) {
        impactParagraph += ` and an i10-index of ${metrics.i10Index} (${metrics.i10Index} publication${metrics.i10Index !== 1 ? 's' : ''} with 10 or more citations)`;
      }
      impactParagraph += '.';

      if (topPaper && topPaper.citations > 0) {
        impactParagraph += ` Their most cited work, "${topPaper.title}", has received ${topPaper.citations.toLocaleString()} citation${topPaper.citations !== 1 ? 's' : ''}.`;
      }
    }
    paragraphs.push(impactParagraph);

    // Productivity & trend paragraph
    let trendParagraph = '';
    const phaseDescriptions: Record<string, string> = {
      'accelerating': 'Their publication output has been accelerating in recent years, suggesting an expanding research program.',
      'steady': 'They maintain a steady publication pace, indicating a sustained and active research program.',
      'decelerating': 'Their recent publication rate has slowed compared to earlier years.',
      'emerging': 'They appear to be in the early stages of their publication career.',
      'inactive': 'There are no publications in the most recent three years in the indexed record.'
    };
    trendParagraph += phaseDescriptions[phase] || '';

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

      const earlyThemes = extractTitleThemes(earlyPubs);
      const recentThemes = extractTitleThemes(recentPubs);

      // Find themes unique to each period (not in the other's top themes)
      const earlySet = new Set(earlyThemes);
      const recentSet = new Set(recentThemes);
      const earlyOnly = earlyThemes.filter(t => !recentSet.has(t)).slice(0, 3);
      const recentOnly = recentThemes.filter(t => !earlySet.has(t)).slice(0, 3);

      const formatList = (items: string[]) => {
        if (items.length === 1) return items[0];
        return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
      };

      if (earlyOnly.length > 0 && recentOnly.length > 0) {
        paragraphs.push(
          `Their earlier work focused on topics such as ${formatList(earlyOnly)}, while their more recent publications have shifted towards ${formatList(recentOnly)}.`
        );
      } else if (recentOnly.length > 0) {
        paragraphs.push(
          `Their recent work has increasingly focused on ${formatList(recentOnly)}.`
        );
      } else if (earlyThemes.length > 0 && recentThemes.length > 0) {
        // Themes overlap — research focus has been consistent
        const shared = earlyThemes.filter(t => recentSet.has(t)).slice(0, 3);
        if (shared.length > 0) {
          paragraphs.push(
            `Throughout their career, their research has consistently centered on ${formatList(shared)}.`
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
      collabParagraph = `${collabPct} of their publications are co-authored, with an average of ${metrics.averageAuthors} authors per paper across ${metrics.totalCoAuthors} unique co-author${metrics.totalCoAuthors !== 1 ? 's' : ''}.`;
      if (metrics.topCoAuthor && metrics.topCoAuthorPapers >= 2) {
        collabParagraph += ` Their most frequent collaborator is ${metrics.topCoAuthor}, with whom they have published ${metrics.topCoAuthorPapers} papers.`;
      }
      paragraphs.push(collabParagraph);
    } else if (publications.length > 0) {
      paragraphs.push('All indexed publications are single-authored.');
    }

    // Venues paragraph
    if (topVenues.length > 0) {
      const venueList = topVenues.map(v => `${v.name} (${v.count} publication${v.count !== 1 ? 's' : ''})`);
      let venuesParagraph = topVenues.length === 1
        ? 'Their most frequent publication outlet is '
        : 'Their most frequent publication outlets include ';
      if (venueList.length === 1) {
        venuesParagraph += venueList[0];
      } else {
        venuesParagraph += venueList.slice(0, -1).join(', ') + ' and ' + venueList[venueList.length - 1];
      }
      venuesParagraph += '.';
      paragraphs.push(venuesParagraph);
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
    if (fieldMetrics.fwci >= 1.0) {
      parts.push(`Their Field-Weighted Citation Impact (FWCI) is ${fwci}, meaning their publications receive ${fwci} times the world average citations for their field and publication year.`);
    } else {
      parts.push(`Their Field-Weighted Citation Impact (FWCI) is ${fwci}, relative to the world average of 1.00 for their field and publication year.`);
    }
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

export function ResearcherNarrative({ data, geoData, onSearch }: ResearcherNarrativeProps) {
  const narrative = useMemo(() => generateNarrativeParagraphs(data), [data]);
  const oaParagraph = useMemo(() => generateOpenAccessParagraph(data), [data]);
  const fieldMetricsParagraph = useMemo(() => generateFieldMetricsParagraph(data.fieldMetrics), [data.fieldMetrics]);
  const geoParagraph = useMemo(() => generateGeoParagraph(geoData), [geoData]);
  const citationDistParagraph = useMemo(() => generateCitationDistributionParagraph(data.metrics, data.totalCitations), [data.metrics, data.totalCitations]);
  const [showReport, setShowReport] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const scholarId = new URLSearchParams(window.location.search).get('user')
    || window.location.pathname.replace(/^\//, '').replace(/\/$/, '')
    || '';

  // Collect all co-author names for linkification
  const coAuthorNames = useMemo(() => {
    const names = new Set<string>();
    for (const pub of data.publications) {
      for (const author of pub.authors) {
        const normalized = author.trim();
        if (normalized && normalized !== data.name && normalized !== '...') {
          names.add(normalized);
        }
      }
    }
    return names;
  }, [data.publications, data.name]);

  const [searchingAuthor, setSearchingAuthor] = useState<string | null>(null);

  const handleAuthorClick = useCallback(async (authorName: string) => {
    if (!onSearch || searchingAuthor) return;
    setSearchingAuthor(authorName);
    try {
      const results = await scholarService.searchAuthors(authorName);
      if (results.length >= 1) {
        const url = `https://scholar.google.com/citations?user=${encodeURIComponent(results[0].authorId)}`;
        onSearch(url);
      }
    } catch {
      // Silently fail — author might not have a Scholar profile
    } finally {
      setSearchingAuthor(null);
    }
  }, [onSearch, searchingAuthor]);

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
    const { error } = await supabase.from('profile_reports').insert({
      author_id: scholarId,
      author_name: data.name,
      reporter_email: reportEmail || null,
      message: reportMsg.trim(),
      page_url: window.location.href,
    });
    if (error) {
      console.error('[Report] Insert failed:', error);
      setReportStatus('idle');
      return;
    }
    setReportStatus('sent');
    setTimeout(() => {
      setShowReport(false);
      setReportMsg('');
      setReportEmail('');
      setReportStatus('idle');
    }, 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center">
          <FileText className="h-4 w-4 text-[#2d7d7d] mr-2" />
          Research Profile
        </h3>
        <button
          onClick={() => setShowReport(!showReport)}
          className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          title="Report an error in this profile"
        >
          <Flag className="h-3 w-3" />
          Report error
        </button>
      </div>

      {showReport && (
        <div className="mb-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
          {reportStatus === 'sent' ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              Thanks! We'll review this.
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-2">
                Spotted something wrong? Let us know and we'll fix it.
              </p>
              <textarea
                value={reportMsg}
                onChange={e => setReportMsg(e.target.value)}
                placeholder="Describe the error (e.g., 'Wrong affiliation', 'Missing publications'...)"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none resize-none mb-2"
                maxLength={1000}
              />
              <input
                type="email"
                value={reportEmail}
                onChange={e => setReportEmail(e.target.value)}
                placeholder="Your email (optional, for follow-up)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none mb-2"
              />
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
                  onClick={() => { setShowReport(false); setReportMsg(''); setReportEmail(''); }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
        {narrative.map((paragraph, i) => (
          <p key={i}>{linkifyText(paragraph)}</p>
        ))}
        {fieldMetricsParagraph && <p>{fieldMetricsParagraph}</p>}
        {citationDistParagraph && <p>{citationDistParagraph}</p>}
        {geoParagraph && <p>{geoParagraph}</p>}
        {oaParagraph && <p>{oaParagraph}</p>}
      </div>
    </div>
  );
}

// Re-export text-only versions for PDF export
export const generateFieldMetricsParagraphText = generateFieldMetricsParagraph;
export const generateGeoParagraphText = generateGeoParagraph;
export const generateCitationDistributionParagraphText = generateCitationDistributionParagraph;
export const generateOpenAccessParagraphText = generateOpenAccessParagraph;
