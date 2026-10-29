/**
 * "Did you mean" ranking for misspelt researcher names. Pure: the OpenAlex
 * fetching lives in services/openalex/name-suggestions.ts.
 *
 * OpenAlex autocomplete is prefix-based, so a typo near the end of a surname
 * ("Hilkn") is rescued by also asking for the surname cut short ("Hilk",
 * "Hil"). Those shorter prefixes pull in many unrelated people, so every
 * candidate is scored against what was actually typed.
 */
import { canonicalNameKey } from '../utils/names';
import { editDistance } from './editDistance';

export interface NameSuggestion {
  /** OpenAlex short id, e.g. "A5040626126". */
  id: string;
  name: string;
  /** Last known institution ("hint" in OpenAlex autocomplete); may be empty. */
  institution: string;
  citedBy: number;
}

/** Shortest surname prefix worth querying: "Hi" matches thousands of people. */
const MIN_PREFIX_LETTERS = 3;

function tokens(name: string): string[] {
  return canonicalNameKey(name).split(' ').filter(Boolean);
}

/**
 * The autocomplete queries for a typed name: the name as typed, then with the
 * surname shortened by one and two letters (never below three letters).
 * "Tim Hilkn" → ["Tim Hilkn", "Tim Hilk", "Tim Hil"].
 */
export function suggestionQueries(query: string): string[] {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const surname = parts[parts.length - 1];
  const head = parts.slice(0, -1);
  const queries = [parts.join(' ')];
  for (const cut of [1, 2]) {
    const prefix = surname.slice(0, surname.length - cut);
    if (prefix.length < MIN_PREFIX_LETTERS) break;
    queries.push([...head, prefix].join(' '));
  }
  return [...new Set(queries)];
}

/** Largest surname edit distance still worth suggesting; longer names absorb
 *  more typos. Looser than the server-side match filter on purpose: these are
 *  offered for the user to confirm, not accepted silently. */
function maxSurnameDistance(length: number): number {
  if (length <= 3) return 1;
  if (length <= 7) return 2;
  return 3;
}

/**
 * Penalty for the given name, or null when it rules the candidate out. An
 * initial ("T") or a prefix ("Tim" / "Timothy") is compatible; a one-letter
 * slip in a longer name ("Jnas") is tolerated but ranked lower.
 */
function givenNamePenalty(typed: string, candidate: string | undefined): number | null {
  if (!candidate) return 2;
  if (typed === candidate) return 0;
  if (candidate.startsWith(typed) || typed.startsWith(candidate)) return 1;
  if (typed.length >= 4 && candidate.length >= 4 && editDistance(typed, candidate, 1) <= 1) return 3;
  return null;
}

/**
 * Score a candidate name against the typed one; lower is better, null means
 * incompatible. The surname dominates (weighted ×10); the given name only
 * reorders candidates whose surnames are equally close.
 */
export function scoreNameSuggestion(query: string, candidateName: string): number | null {
  const typed = tokens(query);
  const cand = tokens(candidateName);
  if (typed.length === 0 || cand.length === 0) return null;

  const typedSurname = typed[typed.length - 1];
  const candSurname = cand[cand.length - 1];
  const max = maxSurnameDistance(typedSurname.length);
  const distance = editDistance(typedSurname, candSurname, max);
  if (distance > max) return null;

  let penalty = 0;
  if (typed.length > 1) {
    const given = givenNamePenalty(typed[0], cand.length > 1 ? cand[0] : undefined);
    if (given === null) return null;
    penalty = given;
  }
  return distance * 10 + penalty;
}

/**
 * Merge autocomplete results from several queries into the best few
 * suggestions: deduplicated by id and by name, incompatible names dropped, the typed name
 * itself dropped (re-running the same search can't help), ranked by score and
 * then by citations so the established researcher wins among namesakes.
 */
export function rankNameSuggestions(query: string, candidates: NameSuggestion[], limit = 5): NameSuggestion[] {
  const typedKey = canonicalNameKey(query);
  const seen = new Set<string>();
  const scored: Array<{ suggestion: NameSuggestion; score: number }> = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    if (canonicalNameKey(c.name) === typedKey) continue;
    const score = scoreNameSuggestion(query, c.name);
    if (score === null) continue;
    scored.push({ suggestion: c, score });
  }
  scored.sort((a, b) => a.score - b.score || b.suggestion.citedBy - a.suggestion.citedBy);
  // Picking a suggestion searches by name, so two same-named records would do
  // the same thing; keep the better-cited one.
  const names = new Set<string>();
  return scored
    .map(s => s.suggestion)
    .filter(s => {
      const key = canonicalNameKey(s.name);
      if (names.has(key)) return false;
      names.add(key);
      return true;
    })
    .slice(0, limit);
}

/** Fewest characters before the typeahead asks OpenAlex anything. */
export const TYPEAHEAD_MIN_CHARS = 3;

/**
 * Whether typed input looks like a person's name worth suggesting for. Pasted
 * Google Scholar links and bare profile ids ("NOSPtp8AAAAJ") must keep going
 * straight to the normal search, so anything URL-like or containing digits is
 * left alone: names don't have digits.
 */
export function isTypeaheadNameQuery(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length < TYPEAHEAD_MIN_CHARS) return false;
  if (/\d/.test(trimmed)) return false;
  if (/[/@?=:]|www\.|scholar\.google|\.[a-z]{2,}$/i.test(trimmed)) return false;
  return /\p{L}/u.test(trimmed);
}
