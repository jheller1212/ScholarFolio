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

/** Strip diacritics, lowercase, remove punctuation except hyphens */
function normalizeName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[.,;:'"()]/g, '')
    .replace(/\s+/g, ' ');
}

/** Parse a name into { given: string[], last: string }
 *  Handles "LastName, FirstName" and "FirstName LastName" formats.
 *  For multi-word last names, uses heuristics (van, de, von, etc.) */
function parseName(normalized: string): { given: string[]; last: string } {
  // Handle "LastName, FirstName MiddleName" format
  if (normalized.includes(',')) {
    const [last, ...rest] = normalized.split(',').map(s => s.trim());
    const given = rest.join(' ').split(' ').filter(Boolean);
    return { given, last };
  }

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length === 0) return { given: [], last: '' };
  if (parts.length === 1) return { given: [], last: parts[0] };

  // Detect multi-word last name prefixes (van, de, von, el, al, di, du, le, la, etc.)
  const prefixes = new Set(['van', 'von', 'de', 'del', 'della', 'di', 'du', 'le', 'la', 'el', 'al', 'bin', 'ibn', 'den', 'der', 'het', 'ter', 'ten']);
  let lastStart = parts.length - 1;
  while (lastStart > 1 && prefixes.has(parts[lastStart - 1])) {
    lastStart--;
  }

  return {
    given: parts.slice(0, lastStart),
    last: parts.slice(lastStart).join(' '),
  };
}

/** Check if two given-name parts are compatible.
 *  "e" matches "emir", "ec" matches "ec", "emir" matches "emir" */
function givenPartMatches(a: string, b: string): boolean {
  if (a === b) return true;
  // One is an initial/abbreviation of the other
  if (a.length <= 2 && b.startsWith(a)) return true;
  if (b.length <= 2 && a.startsWith(b)) return true;
  return false;
}

/** Check if two names likely refer to the same person.
 *  Handles diacritics, initials, abbreviated names, name ordering. */
function isSameAuthor(nameA: string, nameB: string): boolean {
  const a = parseName(normalizeName(nameA));
  const b = parseName(normalizeName(nameB));

  // Last names must match
  if (a.last !== b.last) return false;

  // If either has no given names, last name match is enough
  // (e.g., just "Efendic" listed as author)
  if (a.given.length === 0 || b.given.length === 0) return true;

  // Compare given name parts — the shorter list drives the comparison.
  // "E" matches "Emir", "EC" matches "Elisabeth C", etc.
  const shorter = a.given.length <= b.given.length ? a.given : b.given;
  const longer = a.given.length <= b.given.length ? b.given : a.given;

  // Each part in the shorter set must match some part in the longer set
  // (handles cases where middle names are present in one but not the other)
  const used = new Set<number>();
  for (const sp of shorter) {
    let matched = false;
    for (let i = 0; i < longer.length; i++) {
      if (!used.has(i) && givenPartMatches(sp, longer[i])) {
        used.add(i);
        matched = true;
        break;
      }
    }
    // If a given name part doesn't match any, it could be a combined initial
    // like "ec" matching "e" + "c" or just be a non-match
    if (!matched) {
      // Try combined initials: "ppfm" could match "p" + "p" + "f" + "m"
      // But more commonly "ec" for "elisabeth c" — check if the short part
      // is all initials that match the starts of unused longer parts
      if (sp.length > 1 && sp.length <= 4) {
        const initials = sp.split('');
        let allMatch = true;
        const tempUsed = new Set(used);
        for (const initial of initials) {
          let found = false;
          for (let i = 0; i < longer.length; i++) {
            if (!tempUsed.has(i) && longer[i].startsWith(initial)) {
              tempUsed.add(i);
              found = true;
              break;
            }
          }
          if (!found) { allMatch = false; break; }
        }
        if (allMatch) {
          for (const i of tempUsed) used.add(i);
          matched = true;
        }
      }
      if (!matched) return false;
    }
  }

  return true;
}

/** Decide whether an author string on a paper is the profile owner (and should
 *  therefore be excluded from the co-author list).
 *
 *  Uses isSameAuthor(), plus a looser rule for the one case it misses: an
 *  initials-only variant of the owner whose extra middle initial isn't present
 *  in the owner's stored name — e.g. a profile for "Jane Doe" whose papers
 *  list her as "JM Doe". isSameAuthor rejects that because the "m" has nothing
 *  to match. Here we treat it as the owner when the surnames match and the
 *  co-author side is a pure initials form (every given token ≤ 2 chars) whose
 *  first initial matches the owner's first initial.
 *
 *  Capping at 2-char tokens keeps real first names out (e.g. "James Doe" stays a
 *  co-author). Worst case this drops a same-surname co-author who both shares
 *  the owner's first initial and publishes under two initials — rare and
 *  low-harm — and in exchange the owner never appears as their own collaborator. */
function isProfileOwner(coAuthor: string, owner: string): boolean {
  if (isSameAuthor(coAuthor, owner)) return true;

  const a = parseName(normalizeName(coAuthor));
  const b = parseName(normalizeName(owner));
  if (!a.last || a.last !== b.last) return false;
  if (a.given.length === 0 || b.given.length === 0) return false;

  const coAuthorIsInitialsOnly = a.given.every(part => part.length <= 2);
  return coAuthorIsInitialsOnly && a.given[0][0] === b.given[0][0];
}

// Venues that indicate non-journal output, used only for Google Scholar profiles
// (which carry no work type). OpenAlex profiles use the reliable `type` field.
const NON_JOURNAL_VENUE = /\b(book|chapter|handbook|encyclopedia|proceedings|press|thesis|dissertation|working paper|discussion paper|mimeo|preprint)\b/i;

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
      if (!isProfileOwner(author, cleanAuthorName)) {
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
