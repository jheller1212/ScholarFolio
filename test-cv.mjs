const orcidId = '0000-0002-3214-0724';
const headers = { Accept: 'application/vnd.orcid+json' };

const [ed, em, fu, di] = await Promise.all([
  fetch(`https://pub.orcid.org/v3.0/${orcidId}/educations`, { headers }).then(r => r.json()),
  fetch(`https://pub.orcid.org/v3.0/${orcidId}/employments`, { headers }).then(r => r.json()),
  fetch(`https://pub.orcid.org/v3.0/${orcidId}/fundings`, { headers }).then(r => r.json()),
  fetch(`https://pub.orcid.org/v3.0/${orcidId}/distinctions`, { headers }).then(r => r.json()),
]);

console.log(`${'═'.repeat(60)}`);
console.log(`  ORCID Data for Jonas Heller (${orcidId})`);
console.log(`${'═'.repeat(60)}`);

const edGroups = ed?.['affiliation-group'] || [];
console.log(`\nEducation (${edGroups.length}):`);
if (edGroups.length === 0) console.log('  (none listed)');
for (const g of edGroups) {
  for (const s of g.summaries || []) {
    const e = s['education-summary'];
    const dept = e['department-name'] ? ` in ${e['department-name']}` : '';
    const start = e['start-date']?.year?.value || '';
    const end = e['end-date']?.year?.value || '';
    const range = start && end ? `${start}–${end}` : end || start || '';
    console.log(`  ${e['role-title'] || '?'}${dept}`);
    console.log(`    ${e.organization?.name}${range ? `, ${range}` : ''}`);
  }
}

const emGroups = em?.['affiliation-group'] || [];
console.log(`\nEmployment (${emGroups.length}):`);
if (emGroups.length === 0) console.log('  (none listed)');
for (const g of emGroups) {
  for (const s of g.summaries || []) {
    const e = s['employment-summary'];
    const dept = e['department-name'] ? `, ${e['department-name']}` : '';
    const start = e['start-date']?.year?.value || '?';
    const end = e['end-date']?.year?.value || 'present';
    console.log(`  ${e['role-title'] || '?'}${dept}`);
    console.log(`    ${e.organization?.name} (${start}–${end})`);
  }
}

const fuGroups = fu?.group || [];
console.log(`\nFunding (${fuGroups.length}):`);
if (fuGroups.length === 0) console.log('  (none listed)');
for (const g of fuGroups) {
  for (const s of g['funding-summary'] || []) {
    const start = s['start-date']?.year?.value || '?';
    const end = s['end-date']?.year?.value || '';
    const range = end ? `${start}–${end}` : start;
    console.log(`  ${s.title?.title?.value || '?'}`);
    console.log(`    ${s.organization?.name} (${range})`);
  }
}

const diGroups = di?.['affiliation-group'] || [];
console.log(`\nDistinctions (${diGroups.length}):`);
if (diGroups.length === 0) console.log('  (none listed)');
for (const g of diGroups) {
  for (const s of g.summaries || []) {
    const d = s['distinction-summary'];
    const year = d['start-date']?.year?.value || '';
    console.log(`  ${d['role-title'] || '?'} — ${d.organization?.name}${year ? ` (${year})` : ''}`);
  }
}
