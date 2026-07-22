/**
 * Author-name matching audit.
 *
 *   npx tsx scripts/name-audit/run.ts            # summary
 *   npx tsx scripts/name-audit/run.ts --verbose  # per-profile detail
 *   npx tsx scripts/name-audit/run.ts --json     # machine-readable
 *
 * Recomputes co-author metrics for the fixed sample in profiles.json using the
 * live application code, then checks the invariants that user-reported name
 * bugs violated. Reads cached profiles straight from scholar_cache, so it
 * costs nothing and never touches the paid fetch path.
 *
 * Exits non-zero when a NEW failure appears. Cases listed as knownHard* in the
 * fixture are reported separately: they are tracked limitations, not
 * regressions, and the run stays green while they persist. Fixing one is
 * expected to also remove it from the fixture.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateCoAuthorMetrics } from '../../src/services/metrics/collaboration/co-author-metrics';
import {
  canonicalNameKey,
  extractLastName,
  foldNamePunctuation,
  normalizeAuthorNames,
  surnamesCompatible,
} from '../../src/utils/names';

const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable key — safe to embed, same as client-side
const SUPABASE_KEY = 'sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

interface FixtureProfile {
  scholarId: string;
  name: string;
  publications: number;
  reason: string;
  traits: string[];
  knownHardSelfListed?: string[];
  knownHardDuplicatePairs?: string[];
}

interface Pub { title: string; authors: string[]; citations: number; year: number; venue?: string; type?: string }

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'profiles.json'), 'utf8')) as {
  profiles: FixtureProfile[];
};

const verbose = process.argv.includes('--verbose');
const asJson = process.argv.includes('--json');
/** Sweep every cached profile instead of the fixed sample. Broader coverage,
 *  but the set drifts as the cache changes — use the sample for CI. */
const sweepAll = process.argv.includes('--all');

/** Initials of the given-name part, hyphenated names expanded per component. */
function givenInitials(name: string): string[] {
  return canonicalNameKey(name)
    .split(/\s+/)
    .slice(0, -1)
    .flatMap(token => token.split('-'))
    .map(token => token[0])
    .filter(Boolean);
}

/** Do two names plausibly denote one person? Compatible surname plus one
 *  initials sequence being a prefix of the other. Intentionally looser than
 *  the production owner check so the audit surfaces borderline cases rather
 *  than rubber-stamping whatever the current rules happen to accept. */
function likelySamePerson(a: string, b: string): boolean {
  const lastA = extractLastName(foldNamePunctuation(a));
  const lastB = extractLastName(foldNamePunctuation(b));
  if (!surnamesCompatible(lastA, lastB)) return false;
  const ia = givenInitials(a);
  const ib = givenInitials(b);
  if (ia.length === 0 || ib.length === 0) return false;
  const [short, long] = ia.length <= ib.length ? [ia, ib] : [ib, ia];
  return short.every((ch, i) => ch === long[i]);
}

const TRUNCATION = /^[.…\s]+$/;

interface Finding { profile: string; kind: string; detail: string; known: boolean }

async function fetchProfile(scholarId: string): Promise<{ name: string; publications: Pub[] } | null> {
  const url = `https://scholar.google.com/citations?user=${scholarId}`;
  const endpoint = `${SUPABASE_URL}/rest/v1/scholar_cache?url=eq.${encodeURIComponent(url)}&select=data&limit=1`;
  const res = await fetch(endpoint, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ data: { name?: string; publications?: Pub[] } }>;
  const data = rows[0]?.data;
  if (!data?.name || !data.publications?.length) return null;
  return { name: data.name, publications: data.publications };
}

/** Every cached Google Scholar profile, paged. */
async function fetchAllCached(): Promise<FixtureProfile[]> {
  const out: FixtureProfile[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const endpoint = `${SUPABASE_URL}/rest/v1/scholar_cache`
      + `?select=url,data&url=like.https%3A%2F%2Fscholar.google.com%2Fcitations%3Fuser%3D*`
      + `&limit=500&offset=${offset}`;
    const res = await fetch(endpoint, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) break;
    const rows = (await res.json()) as Array<{ url: string; data: { name?: string; publications?: Pub[] } }>;
    if (!rows.length) break;
    for (const row of rows) {
      const id = row.url.match(/user=([A-Za-z0-9_-]+)/)?.[1];
      if (!id || seen.has(id)) continue;
      if (!row.data?.name || !row.data.publications?.length) continue;
      seen.add(id);
      out.push({
        scholarId: id,
        name: row.data.name,
        publications: row.data.publications.length,
        reason: 'cache-sweep',
        traits: [],
      });
    }
    if (rows.length < 500) break;
  }
  return out;
}

async function main() {
  const findings: Finding[] = [];
  const rows: Array<Record<string, unknown>> = [];
  let missing = 0;
  let checked = 0;

  const targets = sweepAll ? await fetchAllCached() : fixture.profiles;
  // Keep the fixture's accepted findings when sweeping, so a full run still
  // distinguishes tracked limitations from new problems.
  const knownByProfile = new Map(fixture.profiles.map(p => [p.scholarId, p]));

  for (const target of targets) {
    const entry = sweepAll
      ? { ...target, ...(knownByProfile.get(target.scholarId) ?? {}) }
      : target;
    const profile = await fetchProfile(entry.scholarId);
    if (!profile) {
      missing++;
      if (verbose) console.log(`  SKIP  ${entry.name} (no longer in cache)`);
      continue;
    }
    checked++;

    // Same pipeline the app runs on every profile load.
    const pubs = JSON.parse(JSON.stringify(profile.publications)) as Pub[];
    normalizeAuthorNames(pubs);
    const metrics = calculateCoAuthorMetrics(pubs as never, profile.name);
    const coAuthors = metrics.topCoAuthors.map(c => c.name);

    const knownSelf = new Set(entry.knownHardSelfListed ?? []);
    const knownDup = new Set(entry.knownHardDuplicatePairs ?? []);

    // A. the profile owner must never rank as their own collaborator
    for (const name of coAuthors) {
      if (likelySamePerson(name, profile.name)) {
        findings.push({
          profile: profile.name,
          kind: 'self-listed',
          detail: name,
          known: knownSelf.has(name),
        });
      }
    }

    // B. truncation markers are not people
    for (const name of coAuthors) {
      if (TRUNCATION.test(name)) {
        findings.push({ profile: profile.name, kind: 'truncation-marker', detail: name, known: false });
      }
    }

    // C. two entries in one co-author list that denote the same person
    for (let i = 0; i < coAuthors.length; i++) {
      for (let j = i + 1; j < coAuthors.length; j++) {
        if (likelySamePerson(coAuthors[i], coAuthors[j])) {
          const pair = `${coAuthors[i]} ~ ${coAuthors[j]}`;
          const alt = `${coAuthors[j]} ~ ${coAuthors[i]}`;
          findings.push({
            profile: profile.name,
            kind: 'duplicate-co-authors',
            detail: pair,
            known: knownDup.has(pair) || knownDup.has(alt),
          });
        }
      }
    }

    // D. over-filtering guard: a collaborative profile must yield collaborators
    const multiAuthor = pubs.filter(p => (p.authors || []).length > 1).length;
    if (multiAuthor >= 5 && coAuthors.length === 0) {
      findings.push({
        profile: profile.name,
        kind: 'no-co-authors',
        detail: `${multiAuthor} multi-author publications but no collaborators found`,
        known: false,
      });
    }

    rows.push({
      name: profile.name,
      reason: entry.reason,
      publications: pubs.length,
      topCoAuthor: metrics.topCoAuthor,
      totalCoAuthors: metrics.totalCoAuthors,
    });
    if (verbose) {
      console.log(`  ${profile.name}\n      top=${metrics.topCoAuthor || '(none)'}  coAuthors=${metrics.totalCoAuthors}  [${entry.reason}]`);
    }
  }

  const regressions = findings.filter(f => !f.known);
  const known = findings.filter(f => f.known);

  if (asJson) {
    console.log(JSON.stringify({ checked, missing, regressions, known, rows }, null, 2));
  } else {
    console.log(`\nname-audit: ${checked} profiles checked${missing ? `, ${missing} missing from cache` : ''}`);
    const byKind = (list: Finding[]) => {
      const m = new Map<string, number>();
      for (const f of list) m.set(f.kind, (m.get(f.kind) ?? 0) + 1);
      return [...m].map(([k, v]) => `${k}=${v}`).join('  ') || 'none';
    };
    console.log(`known limitations : ${byKind(known)}`);
    console.log(`REGRESSIONS       : ${byKind(regressions)}`);
    for (const f of regressions) {
      console.log(`   ✗ [${f.kind}] ${f.profile}: ${f.detail}`);
    }
    if (verbose && known.length) {
      console.log('\ntracked known-hard cases:');
      for (const f of known) console.log(`   · [${f.kind}] ${f.profile}: ${f.detail}`);
    }
  }

  process.exit(regressions.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('name-audit failed:', err);
  process.exit(2);
});
