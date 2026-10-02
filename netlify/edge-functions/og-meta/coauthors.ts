// Links a profile's co-authors to their ScholarFolio pages for the crawler
// summary. Google Scholar lists co-authors as "T Mandler"-style strings with
// no ids, so a match is "first initial + surname" against cached profiles —
// and only counted when the candidate's own publications list this profile's
// researcher too, so two different "J Smith"s never get cross-linked.
import type { IndexedProfile, Publication } from './supabase.ts';

export function nameKey(name: string): string | null {
  const tokens = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 2) return null;
  const surname = tokens[tokens.length - 1];
  if (surname.length < 2 || !/^[a-z'-]+$/.test(surname)) return null;
  return `${tokens[0][0]} ${surname}`;
}

// Co-author keys ordered by how many papers they share with this profile.
export function frequentCoauthorKeys(pubs: Publication[], selfName: string, max = 15): string[] {
  const self = nameKey(selfName);
  const counts = new Map<string, number>();
  for (const pub of pubs) {
    const seen = new Set<string>();
    for (const author of pub.authors ?? []) {
      const key = nameKey(author);
      if (!key || key === self || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k);
}

export function candidateProfiles(keys: string[], index: IndexedProfile[], selfId: string): IndexedProfile[] {
  const byKey = new Map<string, IndexedProfile[]>();
  for (const p of index) {
    const key = nameKey(p.name);
    if (!key || p.id === selfId) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), p]);
  }
  return keys.flatMap((k) => byKey.get(k) ?? []);
}

export function listsAuthor(authorStrings: string[], selfName: string): boolean {
  const self = nameKey(selfName);
  return !!self && authorStrings.some((a) => nameKey(a) === self);
}
