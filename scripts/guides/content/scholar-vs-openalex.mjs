// Claims come from Google Scholar's own help pages and OpenAlex's documentation.

export default {
  slug: 'google-scholar-vs-openalex-citation-counts',
  funder: 'Explainer',
  format: null,
  lastChecked: '2026-10-02',
  checkedAgainst: 'Google Scholar and OpenAlex documentation',
  title: 'Why Google Scholar and OpenAlex citation counts differ',
  description:
    'Google Scholar and OpenAlex count citations in different ways, so your numbers will not match. What each one counts, why they diverge, and which to cite in a grant application.',
  h1: 'Why Google Scholar and OpenAlex citation counts differ',
  summary: 'Different indexes, different matching, different author profiles: what that means for your numbers.',
  lede:
    'If you compare your citation count on <strong>Google Scholar</strong> with the one in <strong>OpenAlex</strong>, they will almost never match. Neither is wrong: they are built from different collections of documents, with different methods for linking a reference to a paper and different ways of deciding which papers are yours.',
  facts: [
    ['Google Scholar counts', 'Citations from documents its robots find on the web: journal and conference papers, technical reports, drafts, dissertations, preprints, post-prints and abstracts'],
    ['OpenAlex counts', 'Matched references from works already in OpenAlex, taken from sources such as Crossref and PubMed and, for open-access works, from the PDF'],
    ['Your author profile', 'Google Scholar: the article list you maintain · OpenAlex: profiles built by algorithmic disambiguation, which you can correct'],
    ['Metrics shown', 'Google Scholar: citations, h-index and i10-index, each in an All and a Recent version · OpenAlex: per-work and per-author citation counts, per-year counts for about the last ten years'],
  ],
  cta:
    'ScholarFolio shows your headline metrics from Google Scholar and uses OpenAlex for topics, open access, co-authors and the narrative CV draft, so you can see both sides of your record in one place.',
  sections: [
    {
      h2: 'How Google Scholar counts citations',
      html: `<p>Google Scholar indexes scholarly documents from across the web: its inclusion guidelines list journal papers, conference papers, technical reports and their drafts, dissertations, preprints, post-prints and abstracts. Your profile's citation metrics are computed and updated automatically as Google Scholar finds new citations to your work.</p>
<p>A few details explain many surprises:</p>
<ul>
<li>A “Cited by” count marked with an asterisk “includes citations that might not match this article”; Google describes it as an automatic estimate.</li>
<li>Duplicate versions of the same paper split its citations until you merge them in your profile. After a merge the count can be lower than the sum, because a paper that cited both versions is counted once.</li>
<li>Citations go missing when the citing article is not accessible to Google's robots or is formatted in a way its algorithms cannot parse. Google says fixes made by publishers usually take 6 to 9 months to show up.</li>
</ul>`,
    },
    {
      h2: 'How OpenAlex counts citations',
      html: `<p>In OpenAlex, a work's <code>cited_by_count</code> is the number of works that cite it, counted as successful reference matches. OpenAlex takes each work's reference list from its source record (Crossref, PubMed and similar), or from the PDF when the work is open access, and matches each reference to a work already in OpenAlex: by DOI first, which is highly reliable, and otherwise by other bibliographic metadata, which is less reliable.</p>
<p>That process explains why OpenAlex can miss citations: references to works that are not in OpenAlex are dropped, many Crossref records contain no references at all, and references without a DOI can fail to match. Per-year citation counts only cover roughly the last ten years.</p>
<p>Author profiles are built by <em>disambiguation</em>: an algorithm decides which author names on which works belong to the same person. OpenAlex documents two failure modes, <strong>splitting</strong> (one person's works spread over several profiles) and <strong>merging</strong> (different people's works in one profile). Both are fixed by correcting which works belong to a profile. Only about one profile in ten carries an ORCID iD.</p>`,
    },
    {
      h2: 'Which number should you use in a grant application?',
      html: `<p>Often neither. Several funders do not allow author-level metrics such as total citations or the h-index at all (see the <a href="/guides/nwo-veni-vidi-vici-narrative-cv/">NWO</a> and <a href="/guides/snsf-cv-format/">SNSF</a> guides). Where a per-output citation count is allowed, NWO's 2026 forms ask you to name the open database the number came from. OpenAlex publishes its complete database as a free public download, so anyone can check a number you take from it.</p>
<p>Whatever you use, say where the number comes from and when you looked it up, and do not mix sources within one list.</p>`,
    },
  ],
  stepsHeading: 'How to check and fix your numbers',
  steps: [
    {
      title: 'Clean up your Google Scholar profile',
      html: '<p>Remove papers that are not yours and merge duplicate versions of the same paper so their citations are counted together.</p>',
    },
    {
      title: 'Find your OpenAlex author profile',
      html: '<p>Search for yourself and check for split profiles (your papers spread over several entries) or merged ones (someone else’s papers in yours).</p>',
    },
    {
      title: 'Correct OpenAlex where needed',
      html: '<p>OpenAlex fixes profiles by correcting which works belong to them; its help pages explain how, and how ORCID iDs are attached to profiles.</p>',
    },
    {
      title: 'Compare individual papers, not totals',
      html: '<p>Large gaps on one paper usually point to a missing DOI, a duplicate record, or citing documents that only one index covers.</p>',
    },
  ],
  faqs: [
    {
      q: 'Why is my Google Scholar citation count different from OpenAlex?',
      a: 'They index different sets of documents and link citations differently. Google Scholar counts citations from scholarly documents it finds on the web, including preprints, theses and technical reports. OpenAlex counts references it can match to works already in its database, using reference lists from sources such as Crossref and PubMed or from open-access PDFs.',
    },
    {
      q: 'Is Google Scholar or OpenAlex more accurate?',
      a: 'Neither is complete. Google Scholar flags some counts as automatic estimates that may include citations that do not match the article, and OpenAlex drops references it cannot match to a work in its database. Checking your profile in both is the best way to spot errors.',
    },
    {
      q: 'Why did my citation count drop after merging duplicates on Google Scholar?',
      a: 'After a merge, the count is the number of papers citing the merged article. A paper that cited both versions is counted once instead of twice, so the total can be slightly lower than the sum of the two.',
    },
    {
      q: 'Why are some of my papers missing from my OpenAlex profile?',
      a: 'OpenAlex builds author profiles by algorithmically disambiguating author names, which can split one person over several profiles or merge different people. Correcting which works belong to the profile fixes both.',
    },
    {
      q: 'Can I use citation counts in a narrative CV?',
      a: 'It depends on the funder. NWO, for example, does not allow total citations across your work but does allow a citation count as an indicator for a single key output, and asks you to name the open database it came from.',
    },
  ],
  sources: [
    { label: 'Google Scholar — Citations help', url: 'https://scholar.google.com/intl/en/scholar/citations.html' },
    { label: 'Google Scholar — Inclusion guidelines', url: 'https://scholar.google.com/intl/en/scholar/inclusion.html' },
    { label: 'OpenAlex — Citations', url: 'https://help.openalex.org/data/works/citations/' },
    { label: 'OpenAlex — Work attributes', url: 'https://help.openalex.org/data/works/attributes/' },
    { label: 'OpenAlex — Authors', url: 'https://help.openalex.org/data/authors/' },
    { label: 'OpenAlex — Author disambiguation', url: 'https://help.openalex.org/data/authors/disambiguation/' },
    { label: 'OpenAlex — Snapshot (full database download)', url: 'https://help.openalex.org/access/snapshot/' },
    { label: 'NWO — Vidi 2026 pre-proposal form (EBCV instructions)', url: 'https://www.nwo.nl/sites/nwo/files/media-files/Vidi-2026-Pre-proposal-form.docx' },
  ],
};
