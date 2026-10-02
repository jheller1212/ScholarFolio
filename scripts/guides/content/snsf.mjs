// Claims come from the SNSF page "Your curriculum vitae – all about the CV format".

export default {
  slug: 'snsf-cv-format',
  funder: 'SNSF',
  format: null,
  lastChecked: '2026-10-02',
  title: 'SNSF CV format: major achievements, selected works and net academic age',
  description:
    'How to write the Swiss National Science Foundation CV: the five elements, 1–3 major achievements with up to 10 selected works, net academic age, ORCID, and which metrics to leave out.',
  h1: 'SNSF CV format: how to write your major achievements',
  summary: 'Five elements, 1–3 narrative achievements, up to 10 selected works, and no proxy metrics.',
  lede:
    'Applications to the <strong>Swiss National Science Foundation (SNSF)</strong> use a standardised CV that you create on the SNSF Portal. Instead of a long publication list, reviewers focus on <strong>1 to 3 major achievements</strong> described in your own words, each backed by selected works.',
  facts: [
    ['Elements', 'Education and training · previous and current employment · major achievements with selected works · net academic age · ORCID iD'],
    ['Achievements', '1–3 major achievements across your whole career, in narrative form'],
    ['Selected works', 'Max. 10 in total, spread across the achievements; cite each work only once'],
    ['Not allowed', 'Citation metrics, journal rankings, institutional rankings, h-index or other proxy indicators of quality'],
    ['Language', 'The language of your research plan'],
  ],
  cta:
    "ScholarFolio has no SNSF export (the CV is entered on the SNSF Portal), but its narrative CV drafts help you shortlist candidate works and see how your research lines developed, which is the raw material for your major achievements.",
  sections: [
    {
      h2: 'Major achievements with selected works',
      html: `<p>The SNSF asks you to describe 1 to 3 major achievements from across your career. They do not need to relate to the current application: the point is a general description of your most important contributions to date. Achievements can cover your contribution to:</p>
<ul>
<li><strong>Generation of knowledge, innovation and advancement of research</strong>: articles and books, educational and policy publications, code, software, data sets and patented findings</li>
<li><strong>Development and support of peers and the wider research community</strong>: institutional duties, teaching and mentoring, conference and society work, editorial work, and expertise you provided to collaborations</li>
<li><strong>Broader society</strong>: open and citizen science, outreach, engagement with industry and the public sector, and advice to policymakers</li>
</ul>
<p>In describing them you can refer to your specific role or expertise, your findings and their impact on science or society, how you applied skills and new methods, and your approach to teaching, mentoring, leadership and engagement.</p>
<p>Reference a maximum of ten works in total, distributed across the achievements however you like. Any type of work is eligible, but do not cite an individual work more than once. Following the DORA principles, the SNSF asks you not to refer to citation metrics, journal rankings, institutional rankings, your h-index or any other proxy indicators of scientific quality.</p>`,
    },
    {
      h2: 'Net academic age and ORCID',
      html: `<p><strong>Net academic age</strong> is the time you have actually been able to spend on research since your doctorate (or state medical examination), in full-time equivalents and stated in years and months. You can deduct, for example, parental leave, illness, continuing education and public service. Achievements are evaluated relative to this figure, your discipline and your career trajectory.</p>
<p>An <strong>ORCID iD</strong> is required. It appears as a link on your CV, so evaluators may see the works on your public ORCID profile; the SNSF recommends keeping your most recent and most important works visible there. You can import works from ORCID into the SNSF Portal.</p>`,
    },
  ],
  stepsHeading: 'How to write it, step by step',
  steps: [
    {
      title: 'Tidy your ORCID profile first',
      html: '<p>Evaluators may look at it, and the SNSF Portal can import works from it. Make your most recent and most important works visible.</p>',
    },
    {
      title: 'Calculate your net academic age',
      html: '<p>Count research time since your doctorate in full-time equivalents and deduct eligible interruptions. The SNSF provides a separate explanation of the calculation.</p>',
    },
    {
      title: 'Choose one to three achievements',
      html: '<p>Pick contributions that best show your qualifications across the three areas: knowledge, community and society. They need not match the current proposal.</p>',
    },
    {
      title: 'Attach up to ten works',
      html: '<p>Spread them over the achievements, use any output type, and cite each work only once.</p>',
    },
    {
      title: 'Write each achievement as evidence, not a list',
      html: '<p>Explain your role, what changed because of the work, and the skills or methods involved. Leave out h-index, citation counts, journal rankings and other proxy indicators.</p>',
    },
  ],
  faqs: [
    {
      q: 'How many works can I list in an SNSF CV?',
      a: 'A maximum of ten works, distributed across your 1 to 3 major achievements. Each individual work should be cited only once.',
    },
    {
      q: 'Can I mention my h-index or citation counts in an SNSF CV?',
      a: 'No. The SNSF asks applicants not to refer to citation metrics, journal rankings, institutional rankings, their h-index or any other proxy indicators of scientific quality.',
    },
    {
      q: 'Do my achievements have to relate to the project I am proposing?',
      a: 'No. They are a general description of your most important contributions to date. Project-relevant skills belong primarily in the research plan, which lets you reuse the CV with small adaptations.',
    },
    {
      q: 'What is net academic age?',
      a: 'The time you have actually been able to devote to research since your doctorate or state medical examination, in full-time equivalents and stated in years and months, after deducting interruptions such as parental leave or illness.',
    },
    {
      q: 'Where do I create the SNSF CV?',
      a: 'On the SNSF Portal. Each applicant creates their own CV with their own ORCID iD, in the language of the research plan.',
    },
  ],
  sources: [
    { label: 'SNSF — Your curriculum vitae: all about the CV format', url: 'https://www.snf.ch/en/gKcnwW6aEft4bMPF/page/your-curriculum-vitae-all-about-the-cv-format' },
  ],
};
