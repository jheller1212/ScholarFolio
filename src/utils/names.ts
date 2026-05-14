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
      if (a && a.trim()) nameFreq.set(a, (nameFreq.get(a) || 0) + 1);
    }
  }

  // Build a fuzzy key for each name: "baselastname|firstinitial" (lowercased, prefix-stripped)
  function fuzzyKey(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '';
    const lastName = extractLastName(trimmed);
    const baseLast = stripLastNamePrefix(lastName).toLowerCase().replace(/[.,]/g, '');
    const firstPart = trimmed.split(/\s+/)[0];
    const firstInitial = firstPart ? firstPart[0].toLowerCase() : '';
    return `${baseLast}|${firstInitial}`;
  }

  // Group names by fuzzy key
  const groups = new Map<string, string[]>();
  for (const name of nameFreq.keys()) {
    const key = fuzzyKey(name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(name);
  }

  // For each group with >1 variant, pick canonical and build replacement map
  const replacements = new Map<string, string>();
  for (const variants of groups.values()) {
    if (variants.length <= 1) continue;

    // Safety check: all variants must have same base last name (prefix-stripped, case-insensitive)
    const baseLastNames = new Set(variants.map(v =>
      stripLastNamePrefix(extractLastName(v)).toLowerCase().replace(/[.,]/g, '')
    ));
    if (baseLastNames.size > 1) continue;

    // Pick canonical: prefer longest name (most complete), break ties by frequency
    const canonical = variants.sort((a, b) => {
      const lenDiff = b.length - a.length;
      if (lenDiff !== 0) return lenDiff;
      return (nameFreq.get(b) || 0) - (nameFreq.get(a) || 0);
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
