// Claims come from the Horizon Europe MSCA Postdoctoral Fellowships
// application form (Part B-2, section 4), version 5.0 of 27 March 2026.

export default {
  slug: 'msca-postdoctoral-fellowship-cv',
  funder: 'MSCA',
  format: 'msca',
  lastChecked: '2026-10-02',
  title: 'MSCA Postdoctoral Fellowship CV: what Part B-2 section 4 requires',
  description:
    'How to write the researcher CV for a Marie Skłodowska-Curie Postdoctoral Fellowship: required items, the dd/mm/yyyy date rule, outputs without impact factors, and a free draft from your Google Scholar profile.',
  h1: 'MSCA Postdoctoral Fellowship CV: how to write section 4 of Part B-2',
  summary: 'Indicative length 5 pages, exact dates, and outputs described by their significance rather than by impact factor.',
  lede:
    'In a Marie Skłodowska-Curie Postdoctoral Fellowship application, your CV goes in <strong>Part B-2, section 4 “CV of the researcher”</strong>. Part B-2 has no overall page limit, but the template gives the CV an <strong>indicative length of 5 pages</strong> and lists exactly what it should contain.',
  facts: [
    ['Where', 'Part B-2 (separate PDF), section 4 “CV of the researcher”'],
    ['Length', 'Indicative length 5 pages; Part B-2 has no overall page limit'],
    ['Must contain', 'Your name · professional experience · education including the PhD award date'],
    ['Dates', 'Full consecutive dates in dd/mm/yyyy format, most recent first, consistent with Part A'],
    ['Outputs', 'Expected to be open access; give a very short qualitative assessment of significance, not the journal impact factor'],
  ],
  cta:
    'ScholarFolio builds an MSCA-style Word draft from your public profile: education and positions from ORCID, selected publications, and prompts for the sections you complete yourself.',
  sections: [
    {
      h2: 'What the CV must and should include',
      html: `<p>The 2026 application form sets a minimum: the <strong>name of the researcher</strong>, <strong>professional experience</strong> and <strong>education including the PhD award date</strong>, each listed most recent first with exact dates in dd/mm/yyyy format.</p>
<p>It then asks for the standard academic and research record, including information on:</p>
<ul>
<li>Publications in peer-reviewed journals, peer-reviewed conference proceedings and/or monographs, expected to be open access (published or through repositories)</li>
<li>Other outputs significant for your research path, such as data, software and algorithms, expected to be open access in appropriate repositories where possible</li>
<li>Invited presentations at internationally established conferences or international advanced schools</li>
<li>Organisation of international conferences, including steering or programme committee membership</li>
<li>Research expeditions you led, granted patents, and participation in industrial innovation</li>
<li>Prizes and awards, and funding received so far</li>
<li>Supervising and mentoring activities, and other items of interest</li>
</ul>
<p>Publications and other outputs should come with a <em>very short qualitative assessment of their scientific significance</em> and, in the form's words, “not by the Journal Impact Factor”.</p>`,
    },
    {
      h2: 'Career gaps and the PhD defence date',
      html: `<p>Explain any research career gaps or unconventional paths clearly, and make sure the dates match those you entered in Part A. Everything in Parts A and B must be fully consistent.</p>
<p>If you have successfully defended your doctoral thesis before the call deadline but have not yet formally been awarded the degree, state the date of the successful, unconditional defence (viva). The form warns that researchers whose last thesis defence falls after the call deadline are automatically ineligible.</p>`,
    },
  ],
  stepsHeading: 'How to write it, step by step',
  steps: [
    {
      title: 'Copy your dates from Part A',
      html: '<p>Write every position and degree with full dd/mm/yyyy dates, most recent first, and check them against Part A of the proposal.</p>',
    },
    {
      title: 'List education with the PhD award (or defence) date',
      html: '<p>If the degree is not yet formally awarded, give the date of the successful defence.</p>',
    },
    {
      title: 'Select outputs and add one line on each',
      html: '<p>For each publication or other output, add a short qualitative note on its significance. Mark or link open-access versions; the form expects outputs to be open access.</p>',
    },
    {
      title: 'Add the activity sections that apply to you',
      html: '<p>Invited talks, conference organisation, patents, prizes, funding, supervision and mentoring. Leave out headings you have nothing for.</p>',
    },
    {
      title: 'Explain gaps and keep it near five pages',
      html: '<p>Explain career breaks or unconventional paths in plain terms, then trim towards the indicative five pages. Part B-2 must contain only the sections the template requires.</p>',
    },
  ],
  faqs: [
    {
      q: 'Is there a page limit for the MSCA Postdoctoral Fellowship CV?',
      a: 'Part B-2 has no overall page limit, but the 2026 template gives section 4 “CV of the researcher” an indicative length of 5 pages.',
    },
    {
      q: 'Can I include journal impact factors in my MSCA CV?',
      a: 'The form asks for outputs to be accompanied by a very short qualitative assessment of their scientific significance and not by the Journal Impact Factor.',
    },
    {
      q: 'What date format does the MSCA CV use?',
      a: 'Full consecutive dates in dd/mm/yyyy format, with professional experience and education listed most recent first. Dates must match those in Part A.',
    },
    {
      q: 'Where does the CV go in the MSCA proposal?',
      a: 'In Part B-2, section 4. Part B-2 is uploaded as a separate PDF from Part B-1, which has a 10-page limit for sections 1 to 3.',
    },
    {
      q: 'My PhD is defended but not yet awarded. What do I write?',
      a: 'State the date of your successful, unconditional thesis defence. The defence must take place before the call deadline, otherwise the application is ineligible.',
    },
  ],
  sources: [
    { label: 'European Commission — Application form, HE MSCA Postdoctoral Fellowships (v5.0, 27 March 2026, PDF)', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/temp-form/af/af_he-msca-pf_en.pdf' },
  ],
};
