/**
 * OpenAlex sometimes splits one researcher across several author records (a
 * name variant, a move between institutions). Each group below is one person,
 * confirmed by the researcher themselves; the first id is the canonical record,
 * whose name and topics the merged profile shows.
 *
 * Hand-maintained on purpose: merging by name similarity would eventually show
 * someone a stranger's publications, which is worse than a split profile.
 */
const SAME_PERSON: readonly (readonly string[])[] = [
  // Elizabeth M. Beekman — reported 2026-08-03 ("Elizabeth Maria" vs "Elizabeth M.")
  ['A5044727833', 'A5141099083'],
];

/** Every OpenAlex author id belonging to the same person as `shortId`, canonical first. */
export function openAlexRecordsFor(shortId: string): string[] {
  const group = SAME_PERSON.find(ids => ids.includes(shortId));
  return group ? [...group] : [shortId];
}
