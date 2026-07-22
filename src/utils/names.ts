/**
 * Fold the Unicode punctuation that differs between our data sources into its
 * ASCII equivalent. OpenAlex stores "Pein‐Hackelbusch" with U+2010 HYPHEN and
 * Google Scholar emits both that and ASCII "-" for the same author, which made
 * exact-string name comparisons miss (author lookups resolved to the wrong
 * record; authors appeared as their own co-authors).
 */
export function foldNamePunctuation(name: string): string {
  return name
    // hyphen/dash family → ASCII hyphen
    .replace(/[‐‑‒–—―−﹘﹣－]/g, '-')
    // apostrophe family → ASCII apostrophe (O’Brien vs O'Brien)
    .replace(/[‘’‚‛ʼ′]/g, "'")
    // soft hyphen and zero-width characters carry no meaning in a name
    .replace(/[­​‌‍﻿]/g, '')
    // exotic spaces → plain space
    .replace(/[    ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether an author-list entry is a real person rather than a truncation
 * marker. Google Scholar abbreviates long author lists with a trailing "..."
 * (and occasionally "et al."), which otherwise gets counted as a prolific
 * collaborator and can win the top-co-author slot outright.
 */
export function isRealAuthorName(name: string): boolean {
  const s = foldNamePunctuation(name || '').trim();
  if (!s) return false;
  if (/^[.…\s]+$/.test(s)) return false;            // "...", "…", ". . ."
  if (/^et\.?\s*al\.?$/i.test(s)) return false;          // "et al", "et al."
  if (/^and\s+others$/i.test(s)) return false;
  return /\p{L}/u.test(s);                                // must contain a letter
}

/**
 * Comparison key for author names: punctuation-folded, diacritic-stripped,
 * lowercased, with formatting punctuation removed. Hyphens are kept so
 * compound surnames stay distinguishable.
 */
export function canonicalNameKey(name: string): string {
  return foldNamePunctuation(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Comparison key that spells umlauts and related letters out as the digraphs
 * used when a name is typed on an ASCII keyboard: Müller → "mueller", so it
 * matches a byline written "Mueller". `canonicalNameKey` strips the diacritic
 * instead ("muller"), which matches "Muller"; comparing under both keys covers
 * all three spellings a German or Nordic name appears in.
 *
 * Deliberately expands rather than collapses. Collapsing digraphs to the base
 * vowel would also merge genuinely distinct surnames — measured against the
 * cache it conflated Yu/Yue, Cho/Choe, Sun/Suen and Baur/Bauer.
 */
export function umlautExpandedKey(name: string): string {
  return foldNamePunctuation(name)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when two name fragments match under either normalization — diacritic
 *  stripped ("Müller" = "Muller") or umlaut expanded ("Müller" = "Mueller"). */
export function nameFragmentsEquivalent(a: string, b: string): boolean {
  if (!a || !b) return false;
  return canonicalNameKey(a) === canonicalNameKey(b)
    || umlautExpandedKey(a) === umlautExpandedKey(b);
}

/**
 * Split a surname into its meaningful components: "pein-hackelbusch" →
 * ["pein", "hackelbusch"]. Used to recognise maiden/married name pairs, where
 * one surname is a component of the other.
 */
export function surnameComponents(lastName: string): string[] {
  // Punctuation-folded but NOT diacritic-stripped: callers compare components
  // with nameFragmentsEquivalent, which needs the umlauts intact.
  return foldNamePunctuation(lastName)
    .split(/[-\s]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

/**
 * Whether two surnames plausibly belong to the same person: identical, or one
 * is a component of the other's compound form ("Pein" vs "Pein-Hackelbusch",
 * the common maiden→married pattern). Requires the shared component to be
 * ≥3 characters so initials and particles ("de", "van") can't bridge two
 * unrelated surnames. Callers must additionally check given names.
 */
export function surnamesCompatible(lastA: string, lastB: string): boolean {
  if (!canonicalNameKey(lastA) || !canonicalNameKey(lastB)) return false;
  // Compare the originals: canonicalizing first would strip the umlaut that
  // the expanded-key comparison needs (Müller vs Mueller).
  if (nameFragmentsEquivalent(lastA, lastB)) return true;

  const partsA = surnameComponents(lastA);
  const partsB = surnameComponents(lastB);
  if (partsA.length === 0 || partsB.length === 0) return false;
  // Only bridge when one side is a single surname contained in the other's
  // compound form — never merge two different compounds.
  const single = partsA.length === 1 ? partsA[0] : partsB.length === 1 ? partsB[0] : null;
  if (!single || canonicalNameKey(single).length < 3) return false;
  const compound = partsA.length === 1 ? partsB : partsA;
  if (compound.length < 2) return false;
  return compound.some(part => nameFragmentsEquivalent(part, single));
}

/**
 * Extracts the last name from a full name, handling compound last names
 * with common prefixes (van, von, de, del, della, di, da, dos, das, du, den, der).
 *
 * Examples:
 *   "Ko de Ruyter" → "de Ruyter"
 *   "Jan van der Berg" → "van der Berg"
 *   "Albert Einstein" → "Einstein"
 */
export function extractLastName(fullName: string): string {
  const lastNamePrefixes = ['van ', 'von ', 'de ', 'del ', 'della ', 'di ', 'da ', 'dos ', 'das ', 'du ', 'den ', 'der ', 'la ', 'le ', 'el ', 'al-'];

  const nameParts = fullName.trim().split(' ');

  if (nameParts.length <= 1) {
    return nameParts[0] || '';
  }

  // Check for compound last names with prefixes
  for (let i = 1; i < nameParts.length - 1; i++) {
    const possiblePrefix = nameParts[i].toLowerCase() + ' ';
    if (lastNamePrefixes.includes(possiblePrefix)) {
      return nameParts.slice(i).join(' ');
    }
  }

  // Check if last name starts with a hyphenated prefix like "al-"
  for (const prefix of lastNamePrefixes) {
    const trimmed = prefix.trim();
    if (trimmed.endsWith('-') && nameParts[nameParts.length - 1].toLowerCase().startsWith(trimmed)) {
      return nameParts[nameParts.length - 1];
    }
  }

  return nameParts[nameParts.length - 1];
}

const LAST_NAME_PREFIXES = ['van ', 'von ', 'de ', 'del ', 'della ', 'di ', 'da ', 'dos ', 'das ', 'du ', 'den ', 'der ', 'la ', 'le ', 'el ', 'al-'];

/**
 * Strips common surname prefixes (de, van, von, etc.) to get a base last name
 * for fuzzy matching. "de Ruyter" → "Ruyter", "van der Berg" → "Berg".
 */
function stripLastNamePrefix(lastName: string): string {
  let s = lastName;
  // Repeatedly strip leading prefixes (handles "van der" = "van " + "der ")
  let changed = true;
  while (changed) {
    changed = false;
    const lower = s.toLowerCase();
    for (const prefix of LAST_NAME_PREFIXES) {
      const p = prefix.trim();
      if (lower.startsWith(p + ' ')) {
        s = s.substring(p.length).trim();
        changed = true;
        break;
      }
      // Handle hyphenated prefix like "al-"
      if (p.endsWith('-') && lower.startsWith(p)) {
        s = s.substring(p.length);
        changed = true;
        break;
      }
    }
  }
  return s;
}

/**
 * Normalize author names across a list of publications so that near-duplicates
 * (differing only by case, missing middle names/initials, prefix variations
 * like "de Ruyter" vs "De Ruyter" vs "Ruyter") are merged into one canonical form.
 *
 * Strategy:
 *   1. Group names by a fuzzy key: base last name (prefix-stripped) + first initial.
 *   2. Safety-check that all variants share the same base last name.
 *   3. Within each group, pick the most complete/most frequent form as canonical.
 *   4. Replace all variants with the canonical form in-place on the publications.
 *
 * Returns the mutated publications array (same reference) for convenience.
 */
export function normalizeAuthorNames(publications: { authors: string[] }[]): typeof publications {
  // Collect every author name occurrence
  const nameFreq = new Map<string, number>();
  for (const pub of publications) {
    for (const a of pub.authors) {
      if (isRealAuthorName(a)) nameFreq.set(a, (nameFreq.get(a) || 0) + 1);
    }
  }

  // Two fuzzy keys per name — "baselastname|firstinitial" under each surname
  // normalization. A German name reaches us spelled three ways (Müller,
  // Muller, Mueller); the diacritic-stripped key unites the first two and the
  // umlaut-expanded key the first and third, so grouping under both keys
  // brings all three together without merging unrelated surnames.
  function fuzzyKeys(name: string): string[] {
    // Fold Unicode punctuation first so "Pein‐Hackelbusch" (U+2010) and
    // "Pein-Hackelbusch" (ASCII) land in the same group.
    const trimmed = foldNamePunctuation(name);
    if (!trimmed) return [];
    const lastName = stripLastNamePrefix(extractLastName(trimmed));
    const firstPart = trimmed.split(/\s+/)[0];
    const firstInitial = firstPart ? firstPart[0].toLowerCase() : '';
    const canon = canonicalNameKey(lastName);
    const expanded = umlautExpandedKey(lastName);
    if (!canon && !expanded) return [];
    // Deliberately one shared namespace: an umlaut name's expanded key must be
    // able to meet a digraph name's plain key ("Müller" → mueller ← "Mueller").
    const keys = [`${canon}|${firstInitial}`];
    if (expanded && expanded !== canon) keys.push(`${expanded}|${firstInitial}`);
    return keys;
  }

  // Union-find over names, joined by any shared key.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) { const next = parent.get(x)!; parent.set(x, root); x = next; }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const name of nameFreq.keys()) if (!parent.has(name)) parent.set(name, name);
  const keyOwner = new Map<string, string>();
  for (const name of nameFreq.keys()) {
    for (const key of fuzzyKeys(name)) {
      const seen = keyOwner.get(key);
      if (seen) union(name, seen);
      else keyOwner.set(key, name);
    }
  }

  const groups = new Map<string, string[]>();
  for (const name of nameFreq.keys()) {
    if (fuzzyKeys(name).length === 0) continue;
    const root = find(name);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(name);
  }

  // Count non-initial words before the last name (words with >2 chars that aren't the last name)
  function nonInitialWordCount(name: string): number {
    const lastName = extractLastName(name);
    const before = name.slice(0, name.length - lastName.length).trim();
    if (!before) return 0;
    return before.split(/\s+/).filter(w => w.replace(/[.,]/g, '').length > 2).length;
  }

  // For each group with >1 variant, pick canonical and build replacement map
  const replacements = new Map<string, string>();
  for (const variants of groups.values()) {
    if (variants.length <= 1) continue;

    // Safety check: every variant's base surname must be mutually equivalent —
    // identical once diacritics are stripped, or once umlauts are spelled out.
    const baseLastNames = variants.map(v =>
      stripLastNamePrefix(extractLastName(foldNamePunctuation(v)))
    );
    if (!baseLastNames.every(l => nameFragmentsEquivalent(l, baseLastNames[0]))) continue;

    // Safety check: reject groups where variants have different numbers of
    // non-initial words before the last name (e.g. "J Bloemer" vs "J Sit Bloemer")
    const wordCounts = new Set(variants.map(nonInitialWordCount));
    if (wordCounts.size > 1) continue;

    // Pick canonical: prefer most frequent name, break ties by length (most complete)
    const canonical = variants.sort((a, b) => {
      const freqDiff = (nameFreq.get(b) || 0) - (nameFreq.get(a) || 0);
      if (freqDiff !== 0) return freqDiff;
      return b.length - a.length;
    })[0];

    for (const v of variants) {
      if (v !== canonical) replacements.set(v, canonical);
    }
  }

  // Apply replacements
  if (replacements.size > 0) {
    for (const pub of publications) {
      pub.authors = pub.authors.map(a => replacements.get(a) || a);
    }
  }

  return publications;
}
