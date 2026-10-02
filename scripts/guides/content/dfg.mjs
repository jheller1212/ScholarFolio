// Claims come from DFG form 53.200 (version 07/25), DFG form 1.91 (03/25) and
// the DFG FAQ on CVs (last updated 16 September 2026).

export default {
  slug: 'dfg-cv-template',
  funder: 'DFG',
  format: null,
  lastChecked: '2026-10-02',
  title: 'DFG CV template (form 53.200): sections, 10+10 publications, 4-page limit',
  description:
    'How to fill in the mandatory DFG CV template, form 53.200: the sections, up to 10 category A and 10 category B publications, the 4-page limit, and why impact factors and h-index are not considered.',
  h1: 'DFG CV template (form 53.200): how to fill it in',
  summary: 'Mandatory for all DFG programmes: four pages, up to 10 + 10 publications with a note on your role.',
  lede:
    'Since 1 March 2023 every applicant in every DFG programme must use the <strong>DFG CV template, form 53.200</strong>. It is designed for a more individual, qualitative assessment: a short list of your most important results, each with a note on your role, instead of a full publication record.',
  facts: [
    ['Form', 'DFG form 53.200 (current version 07/25), mandatory for all DFG programmes'],
    ['Length', 'Max. 4 pages; Arial 11 pt or larger, line spacing at least 1.2; no photograph'],
    ['Publications', 'Category A: max. 10 (required) · Category B: max. 10 (optional)'],
    ['Metrics', 'Impact factors and h-indices are not required and are not considered in the review'],
    ['File name', 'CV_PubList_&lt;last name&gt;'],
  ],
  cta:
    'ScholarFolio has no DFG export, but its narrative CV drafts give you a shortlist of candidate publications marked by open-access status, plus your positions from ORCID, ready to trim into categories A and B.',
  sections: [
    {
      h2: 'The sections of form 53.200',
      html: `<div class="card table-scroll"><table>
<tr><th scope="row">Personal data</th><td>Table only: title, name, current position (with contract end if applicable), current institution(s) and country, identifiers such as your ORCID iD</td></tr>
<tr><th scope="row">Qualifications and career</th><td>Degree programme, doctorate (date, supervisors, institution) and, optionally after the doctorate, career stages in reverse chronological order</td></tr>
<tr><th scope="row">Supplementary career information</th><td>Optional: circumstances such as childcare, parental leave, long-term illness, disability, caring duties, first-generation academic, migration or pandemic-related downtime</td></tr>
<tr><th scope="row">Activities in the research system</th><td>Optional: committees, academic self-governance, organising events, teaching and mentoring</td></tr>
<tr><th scope="row">Supervision of researchers in early career phases</th><td>Optional (required for Research Training Groups)</td></tr>
<tr><th scope="row">Scientific results</th><td>Category A and Category B lists, each numbered up to 10, with persistent identifiers and a note on your involvement</td></tr>
<tr><th scope="row">Academic distinctions</th><td>Optional: prizes, awards, invitations or appointments to prominent bodies and academies</td></tr>
<tr><th scope="row">Other information</th><td>Optional: anything else relevant, such as dual-career constraints on location</td></tr>
</table></div>`,
    },
    {
      h2: 'Scientific results: categories A and B',
      html: `<p><strong>Category A</strong> (required, up to 10): articles in peer-reviewed journals, contributions to peer-reviewed conferences or anthology volumes, and books.</p>
<p><strong>Category B</strong> (optional, up to 10): any other form of published results, such as non-peer-reviewed conference papers, preprints, data sets, clinical trial protocols, software, patents, blog posts, infrastructure or transfer, and contributions to science communication.</p>
<p>For each item give the title and, as far as possible, all authors, plus a persistent identifier such as a DOI. Mark open-access publications. Where possible, explain how you were involved or why you chose the item. The template states that quantitative metrics such as impact factors and h-indices are not required and are not considered in the review.</p>`,
    },
  ],
  stepsHeading: 'How to fill it in, step by step',
  steps: [
    {
      title: 'Download the current form 53.200',
      html: '<p>Use the template from the DFG website or the elan portal and keep its formatting: Arial 11 pt, line spacing 1.2, four pages maximum.</p>',
    },
    {
      title: 'Fill in personal data and career stages',
      html: '<p>Use the table for personal data. List career stages relevant to the proposal in reverse chronological order.</p>',
    },
    {
      title: 'Pick up to 10 category A publications',
      html: '<p>Choose your most important published results, add DOIs, mark open access, and add a sentence on your role or why each one is listed.</p>',
    },
    {
      title: 'Add category B outputs if they strengthen the case',
      html: '<p>Preprints, data, software and other published results go here, again up to 10.</p>',
    },
    {
      title: 'Decide what context to share',
      html: '<p>Supplementary career information is voluntary. If you want to share something with the DFG Head Office only, use the separate confidential form in elan instead.</p>',
    },
    {
      title: 'Clean up and name the file',
      html: '<p>Delete all grey and red instruction text and name the file CV_PubList_&lt;last name&gt;.</p>',
    },
  ],
  faqs: [
    {
      q: 'Is the DFG CV template mandatory?',
      a: 'Yes. Form 53.200 is mandatory for all applicants submitting proposals under all DFG programmes from 1 March 2023, with limited exceptions for some international collaborative proposals.',
    },
    {
      q: 'How many publications can I list in a DFG CV?',
      a: 'Up to 10 in category A (peer-reviewed journals, peer-reviewed conferences or anthology volumes, and books) and up to 10 further items in category B (any other form of published results).',
    },
    {
      q: 'Should I include impact factors or my h-index?',
      a: 'No need: the DFG states that quantitative metrics such as impact factors and h-indices are not required and are not considered as part of the review.',
    },
    {
      q: 'How long can the DFG CV be?',
      a: 'At most four pages, in Arial 11 point or larger with line spacing of at least 1.2, and without a photograph.',
    },
    {
      q: 'Can I mention career breaks or illness?',
      a: 'Yes, voluntarily, in the supplementary career information section. If you do not want reviewers to see it, the DFG offers a separate confidential form shared only with the Head Office, though that information is then considered only to a limited extent or not at all.',
    },
  ],
  sources: [
    { label: 'DFG — FAQ on CVs (last updated 16 September 2026)', url: 'https://www.dfg.de/en/research-funding/proposal-funding-process/faq/cv' },
    { label: 'DFG form 53.200 — Curriculum vitae template (07/25, RTF)', url: 'https://www.dfg.de/formulare/53_200_elan/53_200_en_elan.rtf' },
    { label: 'DFG form 1.91 — Guidelines for preparing publication lists (03/25, PDF)', url: 'https://www.dfg.de/formulare/1_91/1_91_en.pdf' },
  ],
};
