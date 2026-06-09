/**
 * Batch p-index test for multiple researchers
 */

import 'dotenv/config';
import { computePIndex } from './openalex-pindex.js';

const researchers = [
  'Mark Sanders',
  'Jonas Heller',
  'Joyce Elena Schleu',
  'Nils Fürstenberg',
  'Charlotte Vercammen',
  'Felix Naumann',
  'Dominik Mahr',
  'Chris Easthope Awai',
  'Mary Hausfeld',
  'Yves Van Vaerenbergh',
];

interface Summary {
  name: string;
  works: number;
  worksRanked: number;
  rawPI: number | null;
  owpi: number | null;
  rawPIGlobal: number | null;
  owpiGlobal: number | null;
  apiCalls: number;
}

async function runBatch() {
  const summaries: Summary[] = [];

  for (const name of researchers) {
    try {
      const result = await computePIndex(name);
      if (result) {
        summaries.push({
          name: result.authorName,
          works: result.totalWorks,
          worksRanked: result.worksWithJournalPercentile,
          rawPI: result.rawPIndex,
          owpi: result.owpiPIndex,
          rawPIGlobal: result.rawPIndexGlobal,
          owpiGlobal: result.owpiPIndexGlobal,
          apiCalls: result.apiCallsUsed,
        });
      } else {
        summaries.push({
          name, works: 0, worksRanked: 0,
          rawPI: null, owpi: null, rawPIGlobal: null, owpiGlobal: null, apiCalls: 0,
        });
      }
    } catch (err) {
      console.error(`[ERROR] ${name}: ${err}`);
      summaries.push({
        name, works: 0, worksRanked: 0,
        rawPI: null, owpi: null, rawPIGlobal: null, owpiGlobal: null, apiCalls: 0,
      });
    }
  }

  // Print summary table
  console.log('\n\n');
  console.log('='.repeat(120));
  console.log('P-INDEX BATCH RESULTS (OpenAlex, within-journal-year percentiles, Abbas 2011 weights)');
  console.log('='.repeat(120));
  console.log(
    '  ' +
    'Name'.padEnd(28) +
    'Works'.padEnd(8) +
    'Ranked'.padEnd(9) +
    'Raw PI'.padEnd(10) +
    'OWPI'.padEnd(10) +
    'Raw PI(G)'.padEnd(12) +
    'OWPI(G)'.padEnd(10) +
    'API calls'
  );
  console.log('-'.repeat(120));

  for (const s of summaries) {
    console.log(
      '  ' +
      s.name.slice(0, 26).padEnd(28) +
      String(s.works).padEnd(8) +
      String(s.worksRanked).padEnd(9) +
      (s.rawPI !== null ? s.rawPI.toFixed(2) : '—').padEnd(10) +
      (s.owpi !== null ? s.owpi.toFixed(2) : '—').padEnd(10) +
      (s.rawPIGlobal !== null ? s.rawPIGlobal.toFixed(2) : '—').padEnd(12) +
      (s.owpiGlobal !== null ? s.owpiGlobal.toFixed(2) : '—').padEnd(10) +
      String(s.apiCalls)
    );
  }

  console.log('-'.repeat(120));
  console.log('PI = within-journal percentile avg | OWPI = Abbas-weighted | (G) = global cross-field percentile');
  console.log(`Total researchers: ${summaries.length} | Total API calls: ${summaries.reduce((s, r) => s + r.apiCalls, 0)}`);
}

runBatch().catch(console.error);
