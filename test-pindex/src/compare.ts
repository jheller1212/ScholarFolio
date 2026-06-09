/**
 * Compare OpenAlex vs WoS p-index results side by side
 */

import 'dotenv/config';
import { computeOpenAlexPIndex } from './openalex-pindex.js';
import { computeWosPIndex } from './wos-pindex.js';

const name = process.argv[2] || 'Jonas Heller';
const [firstName, ...rest] = name.split(' ');
const lastName = rest.join(' ');

async function compare() {
  console.log(`\nComparing p-index sources for: ${name}`);
  console.log('='.repeat(60));

  const [oaResult, wosResult] = await Promise.allSettled([
    computeOpenAlexPIndex(name),
    process.env.WOS_API_KEY
      ? computeWosPIndex(firstName, lastName)
      : Promise.resolve(null),
  ]);

  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON');
  console.log('='.repeat(60));

  const oa = oaResult.status === 'fulfilled' ? oaResult.value : null;
  const wos = wosResult.status === 'fulfilled' ? wosResult.value : null;

  if (oaResult.status === 'rejected') {
    console.log(`[OpenAlex] Error: ${oaResult.reason}`);
  }
  if (wosResult.status === 'rejected') {
    console.log(`[WoS] Error: ${wosResult.reason}`);
  }

  const rows = [
    ['Metric', 'OpenAlex', 'WoS'],
    ['---', '---', '---'],
    ['Works found', String(oa?.totalWorks ?? '-'), String(wos?.totalPublications ?? '-')],
    ['Works w/ percentile', String(oa?.worksWithPercentile ?? '-'), String(wos?.publicationsWithRank ?? '-')],
    ['Raw P-Index', String(oa?.rawPIndex ?? '-'), String(wos?.rawPIndex ?? '-')],
    ['Authorship-Weighted PI', String(oa?.authorshipWeightedPIndex ?? '-'), String(wos?.authorshipWeightedPIndex ?? '-')],
    ['Median Percentile', String(oa?.medianPercentile ?? '-'), String(wos?.medianPercentile ?? '-')],
  ];

  console.log('\n');
  for (const row of rows) {
    console.log(`  ${row[0].padEnd(25)} ${row[1].padEnd(15)} ${row[2]}`);
  }

  if (!wos && !process.env.WOS_API_KEY) {
    console.log('\n  [WoS not available — set WOS_API_KEY in .env]');
  }

  // Match publications across sources by title similarity
  if (oa && wos) {
    console.log('\n\nPublication-level comparison (matched by title):');
    console.log('-'.repeat(80));

    let matched = 0;
    const diffs: number[] = [];

    for (const oaPub of oa.publications) {
      const oaTitle = oaPub.title.toLowerCase().slice(0, 40);
      const wosPub = wos.publications.find(w =>
        w.title.toLowerCase().slice(0, 40) === oaTitle
      );
      if (wosPub) {
        matched++;
        const diff = oaPub.percentileMin - wosPub.percentileRank;
        diffs.push(diff);
        console.log(`  "${oaPub.title.slice(0, 50)}..."`);
        console.log(`    OA: ${oaPub.percentileMin}%  |  WoS: ${wosPub.percentileRank}%  |  Diff: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}pp`);
      }
    }

    if (diffs.length > 0) {
      const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      console.log(`\n  Matched ${matched} publications`);
      console.log(`  Mean percentile difference (OA - WoS): ${meanDiff > 0 ? '+' : ''}${meanDiff.toFixed(2)}pp`);
    }
  }
}

compare().catch(console.error);
