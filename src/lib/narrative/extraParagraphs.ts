import type { Author, CoAuthorGeoData, FieldNormalizedMetrics } from '../../types/scholar';
import { pronounsFor, conjugate, capitalizeFirst, type PronounSet } from '../../utils/pronouns';

// Supplementary narrative paragraphs (open access, field-normalised impact,
// geography, citation distribution). Each returns null when data is missing.

export function generateOpenAccessParagraph(data: Author): string | null {
  const pn = pronounsFor(data.pronouns);
  const oa = data.openAccess;
  if (!oa || oa.total === 0) return null;

  let pctLabel: string;
  if (oa.oaPercent >= 90) pctLabel = 'Nearly all';
  else if (oa.oaPercent >= 70) pctLabel = `A large majority (${oa.oaPercent}%)`;
  else if (oa.oaPercent >= 50) pctLabel = `Over half (${oa.oaPercent}%)`;
  else if (oa.oaPercent >= 30) pctLabel = `About a third (${oa.oaPercent}%)`;
  else if (oa.oaPercent >= 10) pctLabel = `A smaller share (${oa.oaPercent}%)`;
  else pctLabel = `A small fraction (${oa.oaPercent}%)`;

  let paragraph = `${pctLabel} of ${pn.possessive} indexed publications are openly accessible.`;

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
        paragraph += ` Open access publishing has been gradually increasing over ${pn.possessive} career.`;
      } else if (diff < -0.15) {
        paragraph += ` Interestingly, the share of open access publications has decreased in recent years.`;
      } else {
        paragraph += ` The proportion of open access publications has remained relatively stable over time.`;
      }
    }
  }

  return paragraph;
}

export function generateFieldMetricsParagraph(fieldMetrics: FieldNormalizedMetrics | null | undefined, pn: PronounSet): string | null {
  if (!fieldMetrics) return null;
  const parts: string[] = [];

  if (fieldMetrics.fwci !== null) {
    const fwci = fieldMetrics.fwci.toFixed(2);
    const meanSuffix = fieldMetrics.fwciMean !== null ? ` (mean: ${fieldMetrics.fwciMean.toFixed(2)})` : '';
    if (fieldMetrics.fwci >= 1.0) {
      parts.push(`${capitalizeFirst(pn.possessive)} median Field-Weighted Citation Impact (FWCI) is ${fwci}${meanSuffix}, meaning a typical publication of ${pn.possessivePronoun} receives ${fwci} times the world-average citations for its field, year, and publication type.`);
    } else {
      parts.push(`${capitalizeFirst(pn.possessive)} median Field-Weighted Citation Impact (FWCI) is ${fwci}${meanSuffix}, relative to the world average of 1.00 for ${pn.possessive} field, year, and publication type.`);
    }
  }

  if (fieldMetrics.topDecileShare !== null) {
    parts.push(`${fieldMetrics.topDecileShare}% of ${pn.possessive} publications rank among the top 10% most-cited papers in ${pn.possessive} field (world baseline: 10%).`);
  }

  if (fieldMetrics.meanCitedness !== null) {
    parts.push(`The mean journal impact of ${pn.possessive} publication outlets is ${fieldMetrics.meanCitedness.toFixed(2)}.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

export function generateGeoParagraph(geoData: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null | undefined, pn: PronounSet): string | null {
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

  let paragraph = `${capitalizeFirst(pn.possessive)} co-authors span ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`;
  if (continents.size > 1) {
    paragraph += ` across ${continents.size} continents`;
  }
  paragraph += `, reflecting ${scope} international collaboration network.`;

  return paragraph;
}

export function generateCitationDistributionParagraph(metrics: Author['metrics'], totalCitations: number, pn: PronounSet): string | null {
  if (totalCitations === 0) return null;
  const parts: string[] = [];

  if (metrics.citationGini > 0) {
    let giniDesc: string;
    if (metrics.citationGini >= 0.8) giniDesc = 'highly concentrated among a few key papers';
    else if (metrics.citationGini >= 0.6) giniDesc = 'moderately concentrated';
    else if (metrics.citationGini >= 0.4) giniDesc = 'moderately spread across publications';
    else giniDesc = 'relatively evenly distributed across publications';
    parts.push(`${capitalizeFirst(pn.possessive)} citation Gini coefficient of ${metrics.citationGini.toFixed(2)} indicates that citations are ${giniDesc}.`);
  }

  if (metrics.citationHalfLife > 0 && metrics.citationHalfLife < 100) {
    parts.push(`The citation half-life is ${metrics.citationHalfLife} year${metrics.citationHalfLife !== 1 ? 's' : ''}, meaning half of all citations were received within ${metrics.citationHalfLife} year${metrics.citationHalfLife !== 1 ? 's' : ''} of publication.`);
  }

  if (metrics.ageNormalizedRate > 0) {
    parts.push(`Age-normalized, ${pn.subject} ${conjugate('receive', pn)} approximately ${metrics.ageNormalizedRate} citation${metrics.ageNormalizedRate !== 1 ? 's' : ''} per career year.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

// Text-only entry points for the PDF/CV exports. They take the whole Author so
// the exported document uses the same pronouns as the page — an export that
// still said "their" after the profile said "her" would be its own bug.
export const generateFieldMetricsParagraphText = (data: Author) =>
  generateFieldMetricsParagraph(data.fieldMetrics, pronounsFor(data.pronouns));
export const generateGeoParagraphText = (
  data: Author,
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null
) => generateGeoParagraph(geoData, pronounsFor(data.pronouns));
export const generateCitationDistributionParagraphText = (data: Author) =>
  generateCitationDistributionParagraph(data.metrics, data.totalCitations, pronounsFor(data.pronouns));
export const generateOpenAccessParagraphText = generateOpenAccessParagraph;

