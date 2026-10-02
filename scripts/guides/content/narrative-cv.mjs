// Cross-funder overview. Every funder-specific number repeats a fact already
// sourced in that funder's own guide; keep them in sync when re-checking.

export default {
  slug: 'how-to-write-a-narrative-cv',
  funder: 'Overview',
  format: null,
  lastChecked: '2026-10-02',
  checkedAgainst: 'official funder documents',
  title: 'How to write a narrative CV for research funding (with funder comparison)',
  description:
    'A practical guide to narrative and evidence-based CVs for grant applications: what funders such as NWO, ERC, UKRI, SNSF and DFG ask for, what to leave out, and how to turn a publication list into evidence.',
  h1: 'How to write a narrative CV for a research grant',
  summary: 'What narrative CVs have in common across funders, a side-by-side comparison, and a writing method.',
  lede:
    'Many research funders have replaced the long publication list with a <strong>narrative CV</strong>: a short, evidence-based account of your contributions, built around a handful of selected outputs. The formats differ in detail, but they share one logic: show what you did, why it mattered, and what your role was, without leaning on journal prestige or author-level metrics.',
  facts: [
    ['NWO (Veni/Vidi/Vici)', 'Academic profile + max. 10 key outputs; h-index, impact factor and journal rankings not allowed'],
    ['ERC', 'Up to 4 pages; up to 10 research outputs + peer recognition + optional career context'],
    ['MSCA Postdoctoral Fellowships', 'Indicative 5 pages; outputs described by significance, not by journal impact factor'],
    ['UKRI (R4RI)', 'Four modules + optional context; word count set per funding opportunity'],
    ['SNSF', '1–3 major achievements with max. 10 works; no citation metrics or rankings'],
    ['DFG', 'Max. 4 pages; up to 10 + 10 publications; impact factors and h-index not considered'],
  ],
  cta:
    'The hardest part of a narrative CV is the first draft. ScholarFolio turns your public Google Scholar profile into an editable Word draft (NWO, ERC or MSCA layout) with candidate outputs and prompts, so you start editing instead of staring at a blank page.',
  sections: [
    {
      h2: 'What narrative CVs have in common',
      html: `<ul>
<li><strong>A small number of selected outputs.</strong> NWO, ERC and SNSF each cap the list at ten; the DFG allows ten peer-reviewed plus ten other published results.</li>
<li><strong>Outputs beyond articles.</strong> Datasets, software and other non-article outputs are explicitly welcome at NWO, ERC, UKRI, SNSF and the DFG.</li>
<li><strong>Your role and the significance, in words.</strong> ERC, NWO and the DFG all ask you to explain your contribution to each selected output.</li>
<li><strong>Contributions to others.</strong> Mentoring, teaching, reviewing, community and societal work have their own place: UKRI modules two to four, NWO's leadership and mentorship section, the SNSF's community and society achievements.</li>
<li><strong>Room for context.</strong> Career breaks, part-time work and other circumstances can be explained (ERC additional information, UKRI additional information, DFG supplementary career information, SNSF net academic age).</li>
<li><strong>No proxy metrics.</strong> Journal impact factors, journal rankings and the h-index are banned (NWO, SNSF), not considered in review (DFG), not to be used by assessors (UKRI), or replaced by a qualitative explanation (MSCA).</li>
</ul>`,
    },
    {
      h2: 'Turning a publication list into evidence',
      html: `<p>A useful pattern for every claim is <em>claim, evidence, significance</em>: state what you contributed, point to the concrete output or activity that shows it, and say what changed as a result. Compare:</p>
<div class="card"><p style="margin:0 0 8px"><strong>List style:</strong> “12 papers on soil microbiomes, including three in top journals.”</p>
<p style="margin:0"><strong>Narrative style:</strong> “I developed the sampling protocol now used across our national monitoring network (output 3), and led the open dataset that two other groups have reused for their own models (output 5).”</p></div>
<p>The second version names a role, points to specific outputs, and shows uptake, without totals, rankings or impact factors, which several funders do not allow.</p>`,
    },
  ],
  stepsHeading: 'A method that works for any funder',
  steps: [
    {
      title: 'Read the current form for your call',
      html: "<p>Word or page limits, section names and banned items change between rounds. The form's own instructions take precedence over any guide, including this one.</p>",
    },
    {
      title: 'Inventory everything first',
      html: '<p>Export your publications, then add what profiles miss: datasets, software, teaching, supervision, reviewing, committees, outreach and policy work.</p>',
    },
    {
      title: 'Pick the outputs that carry your story',
      html: '<p>Choose up to ten that show distinct qualities and connect to the proposal. The ERC explicitly asks for an emphasis on recent achievements.</p>',
    },
    {
      title: 'Write one or two sentences per output',
      html: '<p>Your role, what the output changed, and why it shows you can deliver the project.</p>',
    },
    {
      title: 'Write the narrative around three or four themes',
      html: '<p>For example: research line, methods or tools you created, people you developed, and wider impact. Back each claim with a numbered output or a concrete activity.</p>',
    },
    {
      title: 'Strip proxy metrics and rank words',
      html: '<p>Search for h-index, impact factor, “top journal”, “prestigious”, quartiles and totals. Replace them with what actually happened.</p>',
    },
    {
      title: 'Ask a colleague outside your field to read it',
      html: '<p>Panels are often broad. If a neighbouring-field reader cannot see why an output matters, explain it more plainly.</p>',
    },
  ],
  faqs: [
    {
      q: 'What is a narrative CV?',
      a: 'A CV format that asks researchers to describe their contributions in prose, supported by a small selection of outputs, instead of listing every publication and metric. NWO calls its version the evidence-based CV; UKRI uses the Résumé for Research and Innovation.',
    },
    {
      q: 'Can I put my h-index in a narrative CV?',
      a: 'Usually not. NWO and the SNSF explicitly disallow it, the DFG says it is not considered, and UKRI tells its assessors not to use it. Always check the specific call.',
    },
    {
      q: 'How long is a narrative CV?',
      a: 'It depends on the funder: for example up to 4 pages for the ERC and the DFG, an indicative 5 pages for MSCA Postdoctoral Fellowships, 400 to 700 words for the NWO Veni academic profile, and a call-specific word count for UKRI.',
    },
    {
      q: 'Which outputs should I choose?',
      a: 'The ones that best evidence the qualities the panel is assessing and that connect to your proposal. Funders such as the ERC and NWO explicitly accept datasets, software, preprints and other non-article outputs.',
    },
    {
      q: 'Can I reuse one narrative CV for several funders?',
      a: 'The raw material, yes; the document, rarely. Section names, limits and banned items differ, so adapt the same evidence to each form.',
    },
  ],
  sources: [
    { label: 'NWO — Vidi 2026 pre-proposal form (EBCV instructions)', url: 'https://www.nwo.nl/sites/nwo/files/media-files/Vidi-2026-Pre-proposal-form.docx' },
    { label: 'NWO — Veni 2026 pre-proposal form', url: 'https://www.nwo.nl/sites/nwo/files/media-files/veni_pre-proposal_form_2026.docx' },
    { label: 'ERC Work Programme 2027 (European Commission, PDF)', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/wp-call/2027/wp_horizon-erc-2027_en.pdf' },
    { label: 'European Commission — Application form, HE MSCA Postdoctoral Fellowships (PDF)', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/temp-form/af/af_he-msca-pf_en.pdf' },
    { label: 'UKRI — Résumé for Research and Innovation (R4RI): guidance', url: 'https://www.ukri.org/apply-for-funding/how-to-apply/resume-for-research-and-innovation-r4ri-guidance/' },
    { label: 'UKRI — DORA statement: guidance for assessors and applicants (PDF)', url: 'https://www.ukri.org/wp-content/uploads/2020/10/UKRI-22102020-Final-DORA-statement-external.pdf' },
    { label: 'SNSF — Your curriculum vitae: all about the CV format', url: 'https://www.snf.ch/en/gKcnwW6aEft4bMPF/page/your-curriculum-vitae-all-about-the-cv-format' },
    { label: 'DFG — FAQ on CVs', url: 'https://www.dfg.de/en/research-funding/proposal-funding-process/faq/cv' },
    { label: 'San Francisco Declaration on Research Assessment (DORA)', url: 'https://sfdora.org/read/' },
  ],
};
