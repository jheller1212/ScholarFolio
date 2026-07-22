# Author-name audit

Author identity is the hardest correctness problem in ScholarFolio: the same
researcher reaches us spelled several ways, and two different researchers often
look nearly identical. Getting it wrong is highly visible — a user reported
seeing her own maiden name listed as her top co-author, and a wrong OpenAlex
author match reported "0% open access" for someone with 26 open-access papers.

These two scripts make that behaviour measurable instead of anecdotal.

## `cases.ts` — the identity matrix

```bash
npx tsx scripts/name-audit/cases.ts            # per-class summary
npx tsx scripts/name-audit/cases.ts --verbose  # every case
```

Hand-written cases grouped by the ways names vary, each asking the question the
product asks: *is this byline the same person as the profile owner?* Every class
carries **negative controls** — a matcher that merges everything fails this file
rather than passing it.

Classes covered: hyphenated/compound surnames (including Unicode hyphens),
maiden↔married names, German umlauts and ß, Nordic characters (ø å æ),
Spanish/Portuguese double surnames, surname particles (van/de/von, and the
Portuguese dos/das/da form where the particle introduces a full double
surname), multiple given names and initials blocks, misspelt name variants,
CJK names and romanisation, apostrophes, truncation markers, plus real-world
pairs of distinct people who share a surname.

Cases marked `xfail` are **known, accepted limitations**, asserted to still
fail. If a change fixes one, the run reports "unexpectedly fixed" and the case
should be promoted out of `xfail`. The exit code is non-zero only on real
regressions, so this is safe to wire into CI.

### Known limitations (currently `xfail`)

| case | why it's hard |
|---|---|
| `Muller` ↔ `Mueller` (neither spelled with the umlaut) | Bridging them requires collapsing `ue`→`u`, which measurably conflates real distinct surnames — Yu/Yue, Cho/Choe, Sun/Suen, Baur/Bauer. Handling `Müller` against either spelling is safe and *is* supported; only the two-ASCII-variants case is not. |
| `J García` ↔ `Juan García López` | Matching on one surname of a double surname would merge anyone sharing it. |
| `S O Brien` ↔ `Sean O'Brien` | Dropping the apostrophe makes the surname split into two tokens, indistinguishable from a genuine two-token name. |

## `run.ts` — regression sweep over real profiles

```bash
npx tsx scripts/name-audit/run.ts            # summary
npx tsx scripts/name-audit/run.ts --verbose  # per profile
npx tsx scripts/name-audit/run.ts --json     # machine-readable
```

Replays the live pipeline over the 100 cached profiles in `profiles.json`.

Crucially it checks **every surface that turns an author list into co-authors**,
not just one. The bug that prompted this was a tab still showing a user her own
maiden name after the narrative had been fixed, so each is asserted separately:

| surface | what renders it |
|---|---|
| `metrics/narrative (top co-authors)` | Impact Metrics card, narrative text, PDF export, CV export |
| `metrics/narrative (top co-author)` | the "most frequent collaborator" line |
| `network (collaboration insights)` | Collaboration Insights panel on the Co-author Network tab |
| `network (graph nodes)` | the co-author graph itself |
| `narrative (linkified authors)` | clickable author names in the narrative |
| `world map (co-author set)` | co-authors plotted on the World Map |

The Collaboration Insights figures come from the same exported function the tab
renders (`utils/collaborationInsights.ts`), not a copy — a check written against
a reimplementation would not have caught the original bug.

Four invariants per surface:

- **self-listed** — the owner must never rank as their own collaborator
- **truncation-marker** — Scholar's `...` is not a person
- **duplicate-co-authors** — one list must not contain two entries for one person
- **no-co-authors** — a collaborative profile must still yield collaborators
  (catches over-filtering, the failure mode of fixing the first invariant too
  aggressively)

It reads `scholar_cache` directly, so it costs nothing and never touches the
paid fetch path. Profiles that have since been evicted are reported as missing
rather than failing the run.

## `profiles.json` — the sample

100 profiles chosen deterministically (seed 42) from the cache, stratified so
the rare structural cases are all present rather than left to chance:

| reason | n | why |
|---|---|---|
| `negative-control` | 20 | profiles whose bylines contain a *different* person with the same surname |
| `dotted-initials` | 18 | `Richard F.J. Haans` style |
| `hyphen-surname` | 13 | compound surnames |
| `non-ascii-name` | 11 | diacritics, umlauts, CJK |
| `heavy-ellipsis` | 8 | ≥20 truncated author slots |
| `particle-surname` | 8 | van / de / von |
| `unicode-dash-authors` | 7 | bylines containing U+2010 |
| `baseline` | 7 | ordinary profiles, to catch over-filtering |
| `long-name` | 4 | four or more name tokens |
| `known-failure` | 4 | the profiles that currently exhibit a tracked limitation |

Per-profile `knownHardSelfListed` / `knownHardDuplicatePairs` entries record
exactly which findings are accepted, so a *new* problem on the same profile
still fails the run.

To regenerate the sample after the cache has grown substantially, re-derive it
from `scholar_cache` with the same stratification; keep the seed so the set
stays stable between runs.
