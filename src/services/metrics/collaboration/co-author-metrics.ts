import type { Publication } from '../../../types/scholar';

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

export function calculateCoAuthorMetrics(publications: Publication[], authorName: string): CoAuthorStats {
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

  // Helper function to normalize author names (strip diacritics + punctuation)
  const normalizeAuthorName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.,]/g, '');
  };

  // Strip title suffixes like " - Full Professor" or " - Associate Professor"
  const cleanAuthorName = authorName.replace(/\s*[-–—]\s*(Full|Associate|Assistant|Emeritus|Adjunct|Visiting|Research)?\s*(Professor|Lecturer|Fellow|Director|Dean|Chair|Researcher|Scientist|Engineer|Doctor|PhD|Dr)\b.*/i, '').trim() || authorName;

  // Create variations of the main author's name for matching
  const mainAuthorNormalized = normalizeAuthorName(cleanAuthorName);
  const mainAuthorParts = mainAuthorNormalized.split(' ');
  const mainAuthorVariations = [
    mainAuthorNormalized,
    mainAuthorParts[mainAuthorParts.length - 1],
    mainAuthorParts[0],
    mainAuthorParts.length > 1 ? `${mainAuthorParts[0]} ${mainAuthorParts[mainAuthorParts.length - 1]}` : '',
    mainAuthorParts.length > 1 ? `${mainAuthorParts[mainAuthorParts.length - 1]}, ${mainAuthorParts[0]}` : ''
  ].filter(Boolean);

  // Process each publication
  publications.forEach(pub => {
    if (pub.authors.length === 1) {
      soloCount++;
    }
    
    totalAuthors += pub.authors.length;

    pub.authors.forEach(author => {
      const normalizedAuthor = normalizeAuthorName(author);
      const authorParts = normalizedAuthor.split(' ');
      const isMainAuthor = mainAuthorVariations.some(variation =>
        normalizedAuthor.includes(variation) || variation.includes(normalizedAuthor)
      ) || (
        // Handle abbreviated names: "E Efendic" matches "Emir Efendic"
        // Check if last name matches and first part is an initial of the main author's first name
        authorParts.length >= 2 && mainAuthorParts.length >= 2 &&
        authorParts[authorParts.length - 1] === mainAuthorParts[mainAuthorParts.length - 1] &&
        (authorParts[0].length <= 2 && mainAuthorParts[0].startsWith(authorParts[0]) ||
         mainAuthorParts[0].length <= 2 && authorParts[0].startsWith(mainAuthorParts[0]))
      );

      if (!isMainAuthor) {
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
    averageAuthors: parseFloat((totalAuthors / publications.length).toFixed(1)),
    soloAuthorScore: Math.round((soloCount / publications.length) * 100),
    collaborationScore: Math.round(((publications.length - soloCount) / publications.length) * 100),
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