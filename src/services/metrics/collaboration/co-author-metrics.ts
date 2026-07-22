import type { Publication } from '../../../types/scholar';
import { canonicalNameKey, foldNamePunctuation, isRealAuthorName, surnamesCompatible } from '../../../utils/names';

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

/** Strip diacritics, fold Unicode punctuation, lowercase, remove punctuation
 *  except hyphens. Folding matters: the same author appears as both
 *  "Pein\u2010Hackelbusch" (U+2010) and "Pein-Hackelbusch" (ASCII) in Scholar data. */
function normalizeName(name: string): string {
  return canonicalNameKey(name);
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
  while (lastStart > 1 && prefixes.has(parts[lastStart - 1].toLowerCase())) {
    lastStart--;
  }

  return {
    given: parts.slice(0, lastStart),
    last: parts.slice(lastStart).join(' '),
  };
}

/** Same cleaning as normalizeName but keeps casing AND diacritics: casing is
 *  what distinguishes an initials block ("RFJ") from a short given name
 *  ("Ann"), and the diacritics are needed to tell "Schäfer" from "Schafer"
 *  when matching against the "Schaefer" spelling. */
function cleanKeepCase(name: string): string {
  return foldNamePunctuation(name)
    .replace(/[.,;:'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip diacritics for letter-shape tests, without lowercasing. */
function bareLetters(token: string): string {
  return token.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** A compact block of initials: "R", "RFJ", "HHHW" — all caps, ≤5 letters —
 *  or a ≤2-char token, which is an initials form regardless of casing. */
function isInitialsBlock(token: string): boolean {
  if (!token) return false;
  const bare = bareLetters(token);
  return /^[A-Z]{1,5}$/.test(bare) || bare.length <= 2;
}

/** Expand given names into their initials sequence:
 *  "Richard F.J." → [r,f,j];  "RFJ" → [r,f,j];  "Marnik" → [m].
 *  Hyphenated given names contribute one initial per component, matching how
 *  bylines render them ("Zhi-Qin" → [z,q], "Jean-Luc" → [j,l]). */
function initialsSequence(given: string[]): string[] {
  const out: string[] = [];
  for (const token of given) {
    for (const part of token.split('-').filter(Boolean)) {
      // Compare on the diacritic-stripped letter so "Á" and "A" agree.
      const bare = canonicalNameKey(part);
      if (!bare) continue;
      if (isInitialsBlock(part)) {
        for (const ch of bare) out.push(ch);
      } else {
        out.push(bare[0]);
      }
    }
  }
  return out;
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
  if (!isRealAuthorName(coAuthor)) return false;
  if (isSameAuthor(coAuthor, owner)) return true;

  // Case- and diacritic-preserving parse. Casing is what distinguishes an
  // initials block ("RFJ") from a short given name ("Ann"), and the umlauts
  // must survive for surname comparison ("Schäfer" vs "Schaefer") — the
  // normalized parse has already stripped them.
  const aOrig = parseName(cleanKeepCase(coAuthor));
  const bOrig = parseName(cleanKeepCase(owner));
  if (!aOrig.last || aOrig.given.length === 0 || bOrig.given.length === 0) return false;

  // The byline often carries more initials than the profile name
  // ("Marnik Dekimpe" → "MGM Dekimpe", "Richard F.J. Haans" → "RFJ Haans").
  // Same person when one initials sequence is a prefix of the other; a
  // different initial anywhere still means a different person.
  const initialsCompatible = (a: string[], b: string[]): boolean => {
    if (a.length === 0 || b.length === 0) return false;
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    return shorter.every((ch, i) => ch === longer[i]);
  };

  const aInitials = initialsSequence(aOrig.given);
  const bInitials = initialsSequence(bOrig.given);

  // Surnames may differ by a maiden/married component ("MK Pein" vs
  // "M Pein-Hackelbusch") or by spelling ("Schäfer"/"Schaefer"): authors keep
  // publishing under all of them, and without this they rank as their own most
  // frequent collaborator.
  if (
    surnamesCompatible(aOrig.last, bOrig.last)
    && aOrig.given.every(isInitialsBlock)
    && initialsCompatible(aInitials, bInitials)
  ) {
    return true;
  }

  // Compound surnames written with a space instead of a hyphen, and
  // Spanish/Portuguese double surnames ("Joan Díaz-Calafat" vs "J Diaz
  // Calafat"): the surname spills into tokens the parser read as given names.
  // Compare the trailing tokens as a component SET, which must match exactly —
  // a subset would merge "J García" into "Juan García López", i.e. anyone
  // sharing one surname.
  return compoundSurnamesMatch(aOrig, bOrig) && initialsCompatible(aInitials, bInitials);
}

/** Surname component sets built from the trailing tokens, for names whose
 *  compound surname isn't marked by a hyphen. Only considers splits that leave
 *  at least one given-name token, and only multi-component surnames — single
 *  surnames are already handled by surnamesCompatible. */
function surnameComponentSets(parsed: { given: string[]; last: string }): Array<Set<string>> {
  const tokens = [...parsed.given, ...parsed.last.split(/\s+/).filter(Boolean)];
  const sets: Array<Set<string>> = [];
  for (let take = 1; take <= 2 && take < tokens.length; take++) {
    const tail = tokens.slice(tokens.length - take);
    const components = tail
      .flatMap(token => token.split('-'))
      .map(part => canonicalNameKey(part))
      .filter(part => part.length >= 3);
    if (components.length >= 2) sets.push(new Set(components));
  }
  return sets;
}

function compoundSurnamesMatch(
  a: { given: string[]; last: string },
  b: { given: string[]; last: string }
): boolean {
  const setsA = surnameComponentSets(a);
  const setsB = surnameComponentSets(b);
  for (const sa of setsA) {
    for (const sb of setsB) {
      if (sa.size !== sb.size) continue;
      if ([...sa].every(part => sb.has(part))) return true;
    }
  }
  return false;
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
      if (isRealAuthorName(author) && !isProfileOwner(author, cleanAuthorName)) {
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
