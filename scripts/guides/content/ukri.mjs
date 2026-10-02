// Claims come from UKRI's R4RI guidance page (last updated 30 April 2026) and
// UKRI's DORA statement for assessors and applicants.

export default {
  slug: 'ukri-r4ri-narrative-cv',
  funder: 'UKRI',
  format: null,
  lastChecked: '2026-10-02',
  title: 'UKRI Résumé for Research and Innovation (R4RI): the four modules explained',
  description:
    "How to write UKRI's narrative CV, the Résumé for Research and Innovation (R4RI): the four modules, the additional information section, word counts, and why h-index and impact factors don't count.",
  h1: 'UKRI Résumé for Research and Innovation (R4RI): how to write the narrative CV',
  summary: 'Four modules plus optional context, one résumé for the whole team, word count set by each funding opportunity.',
  lede:
    "The <strong>Résumé for Research and Innovation (R4RI)</strong> is UKRI's flexible narrative CV template. When a funding opportunity asks for it, it goes in the <em>Applicant and team capability to deliver</em> section and is used to evidence a wider range of skills and experience than a traditional academic CV.",
  facts: [
    ['Structure', 'Four modules + optional additional information'],
    ['Word count', 'Set by each funding opportunity; check the call guidance'],
    ['Teams', 'One R4RI for the whole team, even across organisations'],
    ['Assessment', 'Informs the overall assessment; modules are never scored individually'],
    ['Metrics', 'UKRI tells assessors not to use journal impact factors, journal or conference rankings, h-index or i10-index'],
  ],
  cta:
    'ScholarFolio has no R4RI export yet, but its narrative CV drafts pull together the raw material for module one: your key outputs, positions and collaborations. Use them as a starting point and rewrite them into the four modules.',
  sections: [
    {
      h2: 'The four modules',
      html: `<p>UKRI asks you to structure your answer under four module headings. Its guidance gives these examples of what each can include:</p>
<div class="card table-scroll"><table>
<tr><th scope="row">1. Generation of new ideas, tools, methodologies or knowledge</th><td>How you communicated your ideas and results; key outputs such as data sets, software, research and policy publications; skills acquired from past research projects</td></tr>
<tr><th scope="row">2. Development of others and maintenance of effective working relationships</th><td>Expertise you provided that was critical to the team's success; teaching, workshops and mentoring; your leadership in shaping a team's direction</td></tr>
<tr><th scope="row">3. Contributions to the wider research and innovation community</th><td>Positions of responsibility; reviewing, editing and committee work; strategic leadership in influencing a research agenda</td></tr>
<tr><th scope="row">4. Contributions to broader research or innovation users and audiences, and towards wider societal benefit</th><td>Engagement with the public sector, clients and the wider public; research that contributed to public understanding or to policy development</td></tr>
</table></div>
<h3>Additional information (optional)</h3>
<p>Use this section to give context for the rest of your R4RI, for example career breaks, secondments or voluntary work. Panels and reviewers see it, so UKRI advises focusing on how an issue affected your career rather than on the issue itself. Do not use it for extra skills, experience or outputs: that information is not assessed.</p>`,
    },
    {
      h2: 'How assessors use it',
      html: `<p>Assessors use the R4RI to inform their view of the application as a whole; they do not read it in isolation and are never asked to score individual modules. Reviewers and panel members both see it, and it is not anonymised. Some funding opportunities also use it to establish the eligibility of the team, so read the specific call guidance.</p>
<p>Under UKRI's commitment to the San Francisco Declaration on Research Assessment (DORA), assessors are told not to use journal impact factors or any hierarchy of journals, conference rankings, or metrics such as the h-index or i10-index when assessing UKRI grants, and to consider the value and impact of all research outputs, including datasets, software, patents and preprints.</p>`,
    },
  ],
  stepsHeading: 'How to write it, step by step',
  steps: [
    {
      title: 'Find the word limit and team rules in your call',
      html: "<p>The R4RI guidance leaves the word count to each funding opportunity. The call's <em>Applicant and team capability to deliver</em> section also says who to include.</p>",
    },
    {
      title: 'Collect evidence before writing',
      html: '<p>List outputs, roles, teaching, reviewing, committee work, collaborations and public or policy engagement. Note what changed because of each.</p>',
    },
    {
      title: 'Write module one around a few concrete contributions',
      html: '<p>Pick the ideas, tools or outputs most relevant to this project and explain your role and the result, rather than listing everything.</p>',
    },
    {
      title: 'Give modules two to four specific examples',
      html: '<p>Describe the mentoring you did, the community roles you held, and the users or audiences you reached, with outcomes where you have them.</p>',
    },
    {
      title: 'Make the team case',
      html: "<p>For team applications, show how members' experience is complementary. One R4RI covers everyone.</p>",
    },
    {
      title: 'Use additional information only for context',
      html: '<p>Career breaks, secondments, part-time work or voluntary work. Keep new achievements out of it; they will not be assessed there.</p>',
    },
  ],
  faqs: [
    {
      q: 'What is the R4RI word limit?',
      a: "UKRI's guidance says the word count is specified in each funding opportunity, so check the call you are applying to.",
    },
    {
      q: 'Can I include my h-index or journal impact factors in an R4RI?',
      a: "UKRI's DORA statement tells assessors not to use journal impact factors, hierarchies of journals, conference rankings, or metrics such as the h-index or i10-index when assessing UKRI grants, so they will not help your case.",
    },
    {
      q: 'Does every team member write their own R4RI?',
      a: 'No. UKRI asks for one R4RI for the whole team, even when members are at different organisations.',
    },
    {
      q: 'Are the four modules scored separately?',
      a: 'No. Assessors use the R4RI to inform the assessment of the application overall and are never asked to score individual modules.',
    },
    {
      q: 'What goes in the additional information section?',
      a: 'Context for the rest of your R4RI, such as career breaks, secondments and voluntary work. Additional skills, experience or outputs placed there will not be assessed.',
    },
  ],
  sources: [
    { label: 'UKRI — Résumé for Research and Innovation (R4RI): guidance (last updated 30 April 2026)', url: 'https://www.ukri.org/apply-for-funding/how-to-apply/resume-for-research-and-innovation-r4ri-guidance/' },
    { label: 'UKRI — DORA statement: guidance for assessors and applicants (PDF)', url: 'https://www.ukri.org/wp-content/uploads/2020/10/UKRI-22102020-Final-DORA-statement-external.pdf' },
  ],
};
