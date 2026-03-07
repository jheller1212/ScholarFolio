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
