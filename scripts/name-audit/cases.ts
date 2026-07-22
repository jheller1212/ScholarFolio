/**
 * Author-identity test matrix.
 *
 *   npx tsx scripts/name-audit/cases.ts            # per-class pass/fail summary
 *   npx tsx scripts/name-audit/cases.ts --verbose  # every case
 *
 * Each case asks the question the product actually asks: "is this byline the
 * same person as the profile owner?" — the check that decides whether someone
 * is listed as their own top co-author. Every class carries negative controls;
 * a matcher that merges everything must fail this file, not pass it.
 *
 * Cases marked `xfail` are known, accepted limitations. They are asserted to
 * STILL FAIL, so if a change happens to fix one the run reports it as
 * "unexpectedly fixed" and the case should be promoted to a normal
 * expectation. Exit code is non-zero only on real regressions.
 */
import { calculateCoAuthorMetrics } from '../../src/services/metrics/collaboration/co-author-metrics';
import { isRealAuthorName, normalizeAuthorNames } from '../../src/utils/names';

interface Case {
  /** byline as it appears in an author list */
  byline: string;
  /** the profile owner's display name */
  owner: string;
  /** true when byline and owner are the same human */
  same: boolean;
  note: string;
  xfail?: boolean;
}

const MATRIX: Record<string, Case[]> = {
  'hyphenated & compound surnames': [
    { byline: 'M Pein-Hackelbusch', owner: 'Miriam Pein-Hackelbusch', same: true, note: 'plain initial' },
    { byline: 'M Pein‐Hackelbusch', owner: 'Miriam Pein-Hackelbusch', same: true, note: 'U+2010 hyphen' },
    { byline: 'M Pein–Hackelbusch', owner: 'Miriam Pein-Hackelbusch', same: true, note: 'en dash' },
    { byline: 'G Odekerken-Schröder', owner: 'Gaby Odekerken-Schröder', same: true, note: 'compound + umlaut' },
    { byline: 'M Pein-Mueller', owner: 'Miriam Pein-Hackelbusch', same: false, note: 'different compound' },
    { byline: 'J Hackelbusch', owner: 'Miriam Pein-Hackelbusch', same: false, note: 'component, wrong initial' },
  ],

  'maiden / married names': [
    { byline: 'MK Pein', owner: 'Miriam Pein-Hackelbusch', same: true, note: 'maiden name + initials' },
    { byline: 'M Pein', owner: 'Miriam Pein-Hackelbusch', same: true, note: 'maiden name' },
    { byline: 'M Hackelbusch', owner: 'Miriam Pein-Hackelbusch', same: true, note: 'married component' },
    { byline: 'Thomas Pein', owner: 'Miriam Pein-Hackelbusch', same: false, note: 'relative, full given name' },
    { byline: 'T Pein', owner: 'Miriam Pein-Hackelbusch', same: false, note: 'relative, wrong initial' },
  ],

  'german umlauts & eszett': [
    { byline: 'M Müller', owner: 'Michael Muller', same: true, note: 'umlaut vs stripped' },
    { byline: 'M Mueller', owner: 'Michael Müller', same: true, note: 'digraph vs umlaut' },
    { byline: 'M Muller', owner: 'Michael Mueller', same: true, note: 'stripped vs digraph', xfail: true },
    { byline: 'S Schäfer', owner: 'Stefan Schaefer', same: true, note: 'ä/ae' },
    { byline: 'K Köhler', owner: 'Klaus Koehler', same: true, note: 'ö/oe' },
    { byline: 'J Hübner', owner: 'Jan Huebner', same: true, note: 'ü/ue' },
    { byline: 'F Strauß', owner: 'Franz Strauss', same: true, note: 'ß/ss' },
    { byline: 'M Bauer', owner: 'Michael Baur', same: false, note: 'DIFFERENT surnames' },
    { byline: 'A Schmitt', owner: 'Andreas Schmidt', same: false, note: 'DIFFERENT surnames' },
  ],

  'nordic characters': [
    { byline: 'L Møller', owner: 'Lars Moeller', same: true, note: 'ø/oe' },
    { byline: 'A Åkesson', owner: 'Anna Aakesson', same: true, note: 'å/aa' },
    { byline: 'E Ærø', owner: 'Erik Aeroe', same: true, note: 'æ/ae + ø/oe' },
    { byline: 'T Törnqvist', owner: 'Tomas Toernqvist', same: true, note: 'ö/oe swedish' },
    { byline: 'N Sørensen', owner: 'Nils Sorenson', same: false, note: 'DIFFERENT surnames' },
  ],

  'spanish / portuguese double surnames': [
    { byline: 'MA García-Benau', owner: 'María Antonia García Benau', same: true, note: 'hyphen vs space' },
    { byline: 'J Diaz Calafat', owner: 'Joan Díaz-Calafat', same: true, note: 'space vs hyphen + accent' },
    { byline: 'J García', owner: 'Juan García López', same: true, note: 'paternal surname only', xfail: true },
    { byline: 'JC Pérez Rodríguez', owner: 'Juan Carlos Pérez Rodríguez', same: true, note: 'full double surname' },
    { byline: 'A García López', owner: 'Juan García López', same: false, note: 'DIFFERENT person, same surnames' },
    { byline: 'J Lopez', owner: 'Juan García López', same: true, note: 'maternal surname only' },
  ],

  'multiple given names': [
    { byline: 'JC Pérez', owner: 'Juan Carlos Pérez', same: true, note: 'combined initials' },
    { byline: 'J Pérez', owner: 'Juan Carlos Pérez', same: true, note: 'first initial only' },
    { byline: 'AM Schmidt', owner: 'Anna Maria Schmidt', same: true, note: 'two given names' },
    { byline: 'RFJ Haans', owner: 'Richard F.J. Haans', same: true, note: 'dotted initials in profile' },
    { byline: 'MGM Dekimpe', owner: 'Marnik Dekimpe', same: true, note: 'byline has more initials' },
    { byline: 'HHHW Schmidt', owner: 'Harald H.H.W. Schmidt', same: true, note: 'four initials' },
    { byline: 'AB Schmidt', owner: 'Anna Maria Schmidt', same: false, note: 'DIFFERENT second initial' },
    { byline: 'Peter Schmidt', owner: 'Anna Maria Schmidt', same: false, note: 'DIFFERENT given name' },
  ],

  'surname particles': [
    { byline: 'K de Ruyter', owner: 'Ko de Ruyter', same: true, note: 'de particle' },
    { byline: 'E van Miltenburg', owner: 'Emiel van Miltenburg', same: true, note: 'van particle' },
    { byline: 'J van der Berg', owner: 'Jan van der Berg', same: true, note: 'two particles' },
    { byline: 'M von Grafenstein', owner: 'Max von Grafenstein', same: true, note: 'von particle' },
    { byline: 'P de Vries', owner: 'Ko de Ruyter', same: false, note: 'DIFFERENT surname, same particle' },
    { byline: 'AI dos Santos Couto', owner: 'Ana Couto', same: true, note: 'portuguese particle + double surname' },
    { byline: 'M da Silva Santos', owner: 'Maria Santos', same: true, note: 'da particle + double surname' },
    { byline: 'J dos Santos Couto', owner: 'Ana Couto', same: false, note: 'DIFFERENT person, same surnames' },
  ],

  'CJK & romanisation': [
    { byline: 'ZQJ Xu', owner: 'Zhi-Qin John Xu', same: true, note: 'hyphenated given name → initials' },
    { byline: 'JH QIN', owner: 'Jiahu Qin', same: true, note: 'uppercase surname' },
    { byline: 'X Yue', owner: 'Xiang Yu', same: false, note: 'DIFFERENT chinese surnames' },
    { byline: 'S Choe', owner: 'Sung Cho', same: false, note: 'DIFFERENT korean surnames' },
    { byline: 'L Suen', owner: 'Li Sun', same: false, note: 'DIFFERENT surnames' },
  ],

  'apostrophes & punctuation': [
    { byline: "S O'Brien", owner: 'Sean O’Brien', same: true, note: 'curly vs straight apostrophe' },
    { byline: 'S O Brien', owner: "Sean O'Brien", same: true, note: 'apostrophe dropped', xfail: true },
    { byline: 'M D’Angelo', owner: "Marco D'Angelo", same: true, note: 'italian apostrophe' },
  ],

  'truncation markers': [
    { byline: '...', owner: 'Miriam Pein-Hackelbusch', same: false, note: 'ellipsis is not a person' },
    { byline: '…', owner: 'Miriam Pein-Hackelbusch', same: false, note: 'unicode ellipsis' },
  ],

  'misspelt name variants': [
    { byline: 'J Japhat Haruna', owner: 'Jonah Japhet Haruna', same: true, note: 'one-letter typo in middle name' },
    { byline: 'Jonah Japhat Haruna', owner: 'Jonah Japhet Haruna', same: true, note: 'typo, both spelled out' },
    { byline: 'J Jonathan Haruna', owner: 'Jonah Japhet Haruna', same: false, note: 'DIFFERENT middle name' },
    { byline: 'Jon Smith', owner: 'Jan Smith', same: false, note: 'short names one edit apart are DIFFERENT people' },
    { byline: 'Eric Meyer', owner: 'Erik Meyer', same: false, note: 'four letters is below the typo floor' },
    { byline: 'Kristina Petrov', owner: 'Kristine Petrov', same: true, note: 'long given name, one edit' },
  ],

  'unrelated people (global negative controls)': [
    { byline: 'D Caragea', owner: 'Cornelia Caragea', same: false, note: 'real colleagues, same surname' },
    { byline: 'AJ Cropley', owner: 'David Cropley', same: false, note: 'father and son' },
    { byline: 'A Richter', owner: 'Shahper Richter', same: false, note: 'different researchers' },
    { byline: 'J Breitkreutz', owner: 'Miriam Pein-Hackelbusch', same: false, note: 'genuine co-author' },
  ],
};

/** Does the production pipeline treat `byline` as the profile owner? */
function treatedAsOwner(byline: string, owner: string): boolean {
  // A truncation marker is dropped for not being a person at all, which is a
  // different question from "is this the owner" — never report it as a match.
  if (!isRealAuthorName(byline)) return false;
  const pubs = [
    { authors: [byline, owner], citations: 1, year: 2020, title: 'a' },
    { authors: [byline, owner], citations: 1, year: 2021, title: 'b' },
  ];
  normalizeAuthorNames(pubs);
  const metrics = calculateCoAuthorMetrics(pubs as never, owner);
  // Filtered out of the co-author list ⇒ recognised as the owner. Compare on
  // the post-normalisation list, since merging may have rewritten the byline.
  return metrics.topCoAuthors.length === 0;
}

const verbose = process.argv.includes('--verbose');
let regressions = 0;
let unexpectedlyFixed = 0;
let pass = 0;
let known = 0;

console.log('\nAuthor-identity matrix\n');
for (const [className, cases] of Object.entries(MATRIX)) {
  const results = cases.map(c => {
    const actual = treatedAsOwner(c.byline, c.owner);
    const correct = actual === c.same;
    return { ...c, actual, correct };
  });
  const failures = results.filter(r => !r.correct && !r.xfail);
  const knownFails = results.filter(r => !r.correct && r.xfail);
  const fixed = results.filter(r => r.correct && r.xfail);
  regressions += failures.length;
  unexpectedlyFixed += fixed.length;
  known += knownFails.length;
  pass += results.filter(r => r.correct && !r.xfail).length;

  const status = failures.length ? 'FAIL' : knownFails.length ? 'partial' : 'ok';
  console.log(
    `  ${status.padEnd(8)} ${className}  (${results.length - failures.length - knownFails.length}/${results.length} correct` +
    `${knownFails.length ? `, ${knownFails.length} known-hard` : ''})`
  );
  for (const r of results) {
    const show = verbose || (!r.correct);
    if (!show) continue;
    const mark = r.correct ? (r.xfail ? '↑' : '·') : (r.xfail ? '~' : '✗');
    console.log(`       ${mark} "${r.byline}" vs "${r.owner}" → same=${r.actual}, expected ${r.same}  [${r.note}]`);
  }
}

console.log(
  `\n${pass} passing, ${known} known-hard (tracked), ${regressions} regressions` +
  `${unexpectedlyFixed ? `, ${unexpectedlyFixed} unexpectedly fixed — promote these out of xfail` : ''}\n`
);
process.exit(regressions > 0 ? 1 : 0);
