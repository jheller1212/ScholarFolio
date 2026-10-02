import type { Author } from '../../types/scholar';
import type { PIndexResult } from '../../services/openalex/pindex';
import { pronounsFor, conjugate, capitalizeFirst } from '../../utils/pronouns';
import {
  getCareerSpan,
  getTopVenues,
  getProductivityPhase,
  getMostCitedPaper,
  parseAffiliation,
  extractTitleThemes,
  inferResearchMethods,
  inferDiscipline,
} from './analysis';

export function generateNarrativeParagraphs(data: Author, pIndexResult?: PIndexResult | null): string[] {
    const { publications, metrics, topics, name, totalCitations } = data;
    // Neutral they/them unless the researcher has told us otherwise.
    const pn = pronounsFor(data.pronouns);
    const career = getCareerSpan(publications);
    const topVenues = getTopVenues(publications, 3);
    const phase = getProductivityPhase(publications);
    const topPaper = getMostCitedPaper(publications);

    // Build research areas text from topics (defensive: name may be object from SerpAPI)
    const topicNames = topics.map(t => {
      if (typeof t.name === 'object' && t.name !== null) {
        return (t.name as { title?: string }).title || '';
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
      impactParagraph = `Over the course of ${pn.possessive} career, ${lastNameCap} has published **${publications.length}** work${publications.length !== 1 ? 's' : ''} and accumulated **${totalCitations.toLocaleString()}** citation${totalCitations !== 1 ? 's' : ''}, yielding an h-index of **${metrics.hIndex}**`;
      if (metrics.i10Index > 0) {
        impactParagraph += ` and an i10-index of **${metrics.i10Index}** (${metrics.i10Index} publication${metrics.i10Index !== 1 ? 's' : ''} with 10 or more citations)`;
      }
      impactParagraph += '.';

      if (topPaper && topPaper.citations > 0) {
        impactParagraph += ` ${capitalizeFirst(pn.possessive)} most cited work, "${topPaper.title}", has received **${topPaper.citations.toLocaleString()}** citation${topPaper.citations !== 1 ? 's' : ''}.`;
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
      trendParagraph = `${lastNameCap} appears to be in the early stages of ${pn.possessive} publication career.`;
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
            `Throughout ${pn.possessive} career, ${lastNameCap}'s research has consistently centered on ${formatList(shared)}.`
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
        collabParagraph += ` ${lastNameCap}'s most frequent collaborator is ${metrics.topCoAuthor}, with whom ${pn.subject} ${conjugate('have', pn)} co-authored **${metrics.topCoAuthorPapers}** publication${metrics.topCoAuthorPapers !== 1 ? 's' : ''}.`;
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
