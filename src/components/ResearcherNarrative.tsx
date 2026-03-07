import React, { useMemo } from 'react';
import { FileText, TrendingUp, Users, BookOpen, Award } from 'lucide-react';
import type { Author } from '../types/scholar';
import { findJournalRanking } from '../data/journalRankings';

interface ResearcherNarrativeProps {
  data: Author;
}

function getCareerSpan(publications: Author['publications']): { firstYear: number; lastYear: number; years: number } {
  const years = publications.map(p => p.year).filter(y => y > 0);
  if (years.length === 0) return { firstYear: 0, lastYear: 0, years: 0 };
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  return { firstYear, lastYear, years: lastYear - firstYear + 1 };
}

function getTopVenues(publications: Author['publications'], limit: number): { name: string; count: number }[] {
  const venueCounts = new Map<string, number>();
  publications.forEach(pub => {
    const venue = pub.venue?.trim();
    if (venue && venue.length > 0) {
      // Normalize: strip volume/issue/page info after first comma
      const baseName = venue.replace(/,.*$/, '').replace(/\s+\d+.*$/, '').trim();
      if (baseName.length > 0) {
        venueCounts.set(baseName, (venueCounts.get(baseName) || 0) + 1);
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

  return Array.from(venueCounts.entries())
    .sort((a, b) => {
      const prestigeDiff = prestigeScore(b[0]) - prestigeScore(a[0]);
      if (prestigeDiff !== 0) return prestigeDiff;
      return b[1] - a[1]; // Fall back to publication count
    })
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
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

export function ResearcherNarrative({ data }: ResearcherNarrativeProps) {
  const narrative = useMemo(() => {
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

    let careerParagraph = `${name} is a researcher`;
    if (data.affiliation) {
      careerParagraph += ` affiliated with ${data.affiliation}`;
    }
    if (topicsText) {
      careerParagraph += `, working in the areas of ${topicsText}`;
    }
    careerParagraph += '.';

    if (career.firstYear > 0) {
      careerParagraph += ` Their publication record spans ${career.years} year${career.years !== 1 ? 's' : ''}, with the earliest indexed publication dating back to ${career.firstYear}.`;
    }
    paragraphs.push(careerParagraph);

    // Impact paragraph
    let impactParagraph = `Over the course of their career, they have published ${publications.length} work${publications.length !== 1 ? 's' : ''} and accumulated ${totalCitations.toLocaleString()} citations, yielding an h-index of ${metrics.hIndex}`;
    if (metrics.i10Index > 0) {
      impactParagraph += ` and an i10-index of ${metrics.i10Index}`;
    }
    impactParagraph += '.';

    if (topPaper && topPaper.citations > 0) {
      impactParagraph += ` Their most cited work, "${topPaper.title}", has received ${topPaper.citations.toLocaleString()} citation${topPaper.citations !== 1 ? 's' : ''}.`;
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

    if (metrics.citationGrowthRate !== 0) {
      const growthDirection = metrics.citationGrowthRate > 0 ? 'growing' : 'declining';
      trendParagraph += ` Citations have been ${growthDirection} at an average rate of ${Math.abs(metrics.citationGrowthRate)}% per year over the last three complete years.`;
    }
    if (trendParagraph) paragraphs.push(trendParagraph);

    // Collaboration paragraph
    let collabParagraph = '';
    if (metrics.collaborationScore > 0) {
      collabParagraph = `Approximately ${metrics.collaborationScore}% of their publications are co-authored, with an average of ${metrics.averageAuthors} authors per paper across ${metrics.totalCoAuthors} unique co-author${metrics.totalCoAuthors !== 1 ? 's' : ''}.`;
      if (metrics.topCoAuthor) {
        collabParagraph += ` Their most frequent collaborator is ${metrics.topCoAuthor}, with whom they have published ${metrics.topCoAuthorPapers} paper${metrics.topCoAuthorPapers !== 1 ? 's' : ''}.`;
      }
      paragraphs.push(collabParagraph);
    }

    // Venues paragraph
    if (topVenues.length > 0) {
      const venueList = topVenues.map(v => `${v.name} (${v.count})`);
      let venuesParagraph = `Their work has appeared in outlets including `;
      if (venueList.length === 1) {
        venuesParagraph += venueList[0];
      } else {
        venuesParagraph += venueList.slice(0, -1).join(', ') + ' and ' + venueList[venueList.length - 1];
      }
      venuesParagraph += '.';
      paragraphs.push(venuesParagraph);
    }

    return paragraphs;
  }, [data]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 flex items-center mb-3">
        <FileText className="h-4 w-4 text-[#2d7d7d] mr-2" />
        Research Profile
      </h3>
      <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
        {narrative.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
