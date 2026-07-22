import type { Publication } from '../../../types/scholar';
import { isRealAuthorName, isSameResearcher } from '../../../utils/authorIdentity';

interface CoAuthorStats {
  totalCoAuthors: number;
  averageAuthors: number;
  soloAuthorScore: number;
  collaborationScore: number;
  topCoAuthor: string;
  topCoAuthorPapers: number;
  topCoAuthorCitations: number;
  topCoAuthorFirstYear: number;
  topCoAuthorLastYear: number;
  topCoAuthorFirstPaper: string;
  topCoAuthorLastPaper: string;
  topCoAuthors: Array<{ name: string; papers: number }>;
}

// Venues that indicate non-journal output, used only for Google Scholar profiles
// (which carry no work type). OpenAlex profiles use the reliable `type` field.
// Deliberately excludes "proceedings"/"press": conference papers are the primary
// peer-reviewed venue in CS/engineering, and excluding them gutted co-author
// stats for conference-heavy scholars (measured: 18–53% of works dropped). This
// targets the actual reported issue — book chapters — plus theses and preprints.
const NON_JOURNAL_VENUE = /\b(book|chapter|handbook|encyclopedia|encyclopaedia|thesis|dissertation|working paper|discussion paper|mimeo|preprint|arxiv|ssrn|biorxiv)\b/i;

/** Whether a publication is a peer-reviewed journal article for the purposes of
 *  collaboration counting. Books and book chapters must not count toward
 *  "co-authored N publications with X". OpenAlex gives a reliable work type;
 *  Google Scholar doesn't, so there we keep everything except clearly
 *  non-journal venues (Scholar entries are overwhelmingly articles). */
function isJournalArticle(pub: Publication): boolean {
  if (pub.type) return pub.type === 'article' || pub.type === 'review';
  const venue = pub.venue || '';
  if (!venue) return true;
  return !NON_JOURNAL_VENUE.test(venue);
}

export function calculateCoAuthorMetrics(publications: Publication[], authorName: string): CoAuthorStats {
  // Collaboration stats count peer-reviewed journal articles only — books and
  // book chapters shouldn't inflate "co-authored N publications with X". Fall
  // back to all publications when a profile has no detectable articles, so a
  // book-only scholar still gets sensible (non-empty) collaboration stats.
  const journalPubs = publications.filter(isJournalArticle);
  const pubs = journalPubs.length > 0 ? journalPubs : publications;

  const coAuthorCounts = new Map<string, {
    count: number;
    citations: number;
    firstYear: number;
    lastYear: number;
    firstPaper: string;
    lastPaper: string;
  }>();

  let totalAuthors = 0;
  let soloCount = 0;

  // Strip title suffixes like " - Full Professor" or " - Associate Professor"
  const cleanAuthorName = authorName.replace(/\s*[-–—]\s*(Full|Associate|Assistant|Emeritus|Adjunct|Visiting|Research)?\s*(Professor|Lecturer|Fellow|Director|Dean|Chair|Researcher|Scientist|Engineer|Doctor|PhD|Dr)\b.*/i, '').trim() || authorName;

  // Process each publication
  pubs.forEach(pub => {
    if (pub.authors.length === 1) {
      soloCount++;
    }

    totalAuthors += pub.authors.length;

    pub.authors.forEach(author => {
      // Truncation markers ("..." on long author lists) still count toward
      // totalAuthors above — they stand for real hidden authors — but must
      // never become a *named* collaborator.
      if (isRealAuthorName(author) && !isSameResearcher(author, cleanAuthorName)) {
        const existingData = coAuthorCounts.get(author) || {
          count: 0,
          citations: 0,
          firstYear: pub.year,
          lastYear: pub.year,
          firstPaper: pub.title,
          lastPaper: pub.title
        };

        coAuthorCounts.set(author, {
          count: existingData.count + 1,
          citations: existingData.citations + pub.citations,
          firstYear: Math.min(existingData.firstYear, pub.year),
          lastYear: Math.max(existingData.lastYear, pub.year),
          firstPaper: existingData.firstYear > pub.year ? pub.title : existingData.firstPaper,
          lastPaper: existingData.lastYear < pub.year ? pub.title : existingData.lastPaper
        });
      }
    });
  });

  // Find the top co-author
  let topCoAuthor = '';
  let topCoAuthorData = {
    count: 0,
    citations: 0,
    firstYear: 0,
    lastYear: 0,
    firstPaper: '',
    lastPaper: ''
  };

  coAuthorCounts.forEach((data, author) => {
    if (data.count > topCoAuthorData.count) {
      topCoAuthor = author;
      topCoAuthorData = data;
    }
  });

  // Top co-authors sorted by paper count (max 4, min 2 papers each)
  const topCoAuthors = [...coAuthorCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .filter(([, d]) => d.count >= 2)
    .map(([name, d]) => ({ name, papers: d.count }));

  return {
    totalCoAuthors: coAuthorCounts.size,
    averageAuthors: parseFloat((totalAuthors / pubs.length).toFixed(1)),
    soloAuthorScore: Math.round((soloCount / pubs.length) * 100),
    collaborationScore: Math.round(((pubs.length - soloCount) / pubs.length) * 100),
    topCoAuthor,
    topCoAuthorPapers: topCoAuthorData.count,
    topCoAuthorCitations: topCoAuthorData.citations,
    topCoAuthorFirstYear: topCoAuthorData.firstYear,
    topCoAuthorLastYear: topCoAuthorData.lastYear,
    topCoAuthorFirstPaper: topCoAuthorData.firstPaper,
    topCoAuthorLastPaper: topCoAuthorData.lastPaper,
    topCoAuthors
  };
}
