/**
 * Author identity — the single definition of "are these two bylines the same
 * researcher?".
 *
 * This lived inline in the co-author metrics service while three other places
 * (the citation network, the collaboration insights panel, the co-author map)
 * each compared author strings with `===`. The result was that a researcher
 * whose name varies between papers appeared as their own top collaborator in
 * every tab that hadn't been fixed. Anything comparing author names must import
 * from here rather than grow a fourth implementation.
 *
 * Behaviour is exercised by scripts/name-audit — see that README for the
 * variant classes covered and the known limitations.
 */
import {
  canonicalNameKey,
  foldNamePunctuation,
  isRealAuthorName,
  surnamesCompatible,
} from './names';

export { isRealAuthorName };

/** Strip diacritics for letter-shape tests, without lowercasing. */
function bareLetters(token: string): string {
  return token.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Diacritic-stripped, lowercased, punctuation-folded — the comparison form. */
export function normalizeName(name: string): string {
  return canonicalNameKey(name);
}

/** Same cleaning as normalizeName but keeps casing AND diacritics: casing is
 *  what distinguishes an initials block ("RFJ") from a short given name
 *  ("Ann"), and the diacritics are needed to tell "Schäfer" from "Schafer"
 *  when matching against the "Schaefer" spelling. */
export function cleanKeepCase(name: string): string {
  return foldNamePunctuation(name)
    .replace(/[.,;:'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A compact block of initials: "R", "RFJ", "HHHW" — all caps, ≤5 letters —
 *  or a ≤2-char token, which is an initials form regardless of casing. */
export function isInitialsBlock(token: string): boolean {
  if (!token) return false;
  const bare = bareLetters(token);
  return /^[A-Z]{1,5}$/.test(bare) || bare.length <= 2;
}

/** Expand given names into their initials sequence:
 *  "Richard F.J." → [r,f,j];  "RFJ" → [r,f,j];  "Marnik" → [m].
 *  Hyphenated given names contribute one initial per component, matching how
 *  bylines render them ("Zhi-Qin" → [z,q], "Jean-Luc" → [j,l]). */
export function initialsSequence(given: string[]): string[] {
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

/** Parse a name into { given, last }. Handles "Last, First" and multi-word
 *  surname particles (van, de, von …). */
export function parseName(cleaned: string): { given: string[]; last: string } {
  if (cleaned.includes(',')) {
    const [last, ...rest] = cleaned.split(',').map(s => s.trim());
    const given = rest.join(' ').split(' ').filter(Boolean);
    return { given, last };
  }

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 0) return { given: [], last: '' };
  if (parts.length === 1) return { given: [], last: parts[0] };

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

/** Check if two given-name parts are compatible.
 *  "e" matches "emir", "ec" matches "ec", "emir" matches "emir" */
function givenPartMatches(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length <= 2 && b.startsWith(a)) return true;
  if (b.length <= 2 && a.startsWith(b)) return true;
  return false;
}

/** Two names that agree on surname and given names, allowing initials and
 *  missing middle names. Stricter than isSameResearcher. */
export function isSameAuthor(nameA: string, nameB: string): boolean {
  const a = parseName(normalizeName(nameA));
  const b = parseName(normalizeName(nameB));

  if (a.last !== b.last) return false;
  if (a.given.length === 0 || b.given.length === 0) return true;

  const shorter = a.given.length <= b.given.length ? a.given : b.given;
  const longer = a.given.length <= b.given.length ? b.given : a.given;

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
    if (!matched) {
      // Combined initials: "ec" matching "elisabeth" + "carla"
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

function initialsCompatible(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((ch, i) => ch === longer[i]);
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

/**
 * Whether a byline denotes the same researcher as `reference` — the check that
 * decides if someone is being listed as their own collaborator.
 *
 * Beyond isSameAuthor it accepts the ways one person's name legitimately
 * varies between papers: maiden vs married surnames ("MK Pein" vs
 * "M Pein-Hackelbusch"), spelling variants ("Schäfer"/"Schaefer"), bylines
 * carrying more initials than the profile name ("Marnik Dekimpe" →
 * "MGM Dekimpe"), and compound surnames written with a space instead of a
 * hyphen ("Joan Díaz-Calafat" vs "J Diaz Calafat").
 *
 * Deliberately conservative in the other direction: a differing initial still
 * means a different person, so relatives and same-surname colleagues stay
 * separate (verified against real pairs — Doina vs Cornelia Caragea, Arthur J.
 * vs David Cropley).
 */
export function isSameResearcher(byline: string, reference: string): boolean {
  if (!isRealAuthorName(byline) || !reference) return false;
  if (isSameAuthor(byline, reference)) return true;

  const a = parseName(cleanKeepCase(byline));
  const b = parseName(cleanKeepCase(reference));
  if (!a.last || a.given.length === 0 || b.given.length === 0) return false;

  const aInitials = initialsSequence(a.given);
  const bInitials = initialsSequence(b.given);

  if (
    surnamesCompatible(a.last, b.last)
    && a.given.every(isInitialsBlock)
    && initialsCompatible(aInitials, bInitials)
  ) {
    return true;
  }

  return compoundSurnamesMatch(a, b) && initialsCompatible(aInitials, bInitials);
}

/**
 * Drop the profile owner and non-person entries (Scholar's "..." truncation
 * marker) from an author list. The one helper every co-author view should use.
 */
export function coAuthorsOf(authors: string[] | undefined, owner: string): string[] {
  return (authors ?? []).filter(a => isRealAuthorName(a) && !isSameResearcher(a, owner));
}

/**
 * Best guess at whose profile a publication list belongs to, for views that
 * aren't given the profile name: the most frequent real author name.
 */
export function inferMainAuthor(publications: Array<{ authors?: string[] }>): string {
  const freq = new Map<string, number>();
  for (const pub of publications) {
    for (const a of pub.authors ?? []) {
      if (isRealAuthorName(a)) freq.set(a, (freq.get(a) ?? 0) + 1);
    }
  }
  let best = '';
  let bestCount = 0;
  for (const [name, count] of freq) {
    if (count > bestCount) { best = name; bestCount = count; }
  }
  return best;
}
