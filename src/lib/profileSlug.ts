// Letters NFKD can't split into base + accent. Without these, "Søren" or
// "Weiß" would lose a letter and leave a stray hyphen.
const SPECIAL_LETTERS: Record<string, string> = {
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', þ: 'th', ł: 'l', ı: 'i',
};

/**
 * Suggested vanity slug for a researcher name, e.g. "Jonas Heller" -> "jonas-heller",
 * "Frédéric Dufays" -> "frederic-dufays". Only used to pre-fill a NEW claim;
 * existing slugs are stored and never regenerated.
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ßæœøđðþłı]/g, (c) => SPECIAL_LETTERS[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}
