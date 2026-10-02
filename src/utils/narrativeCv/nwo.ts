import type { Paragraph } from 'docx';
import type { Author, CoAuthorGeoData } from '../../types/scholar';
import type { OrcidProfile } from '../../services/orcid';
import { generateNarrativeParagraphs } from '../../lib/narrative/paragraphs';
import {
  bodyParagraph, distinctionEntries, documentHeader, educationEntries, employmentEntries, footerParagraph,
  fundingEntries, labelValueParagraph, placeholderParagraph, publicationEntries, sectionHeading, subHeading,
} from './docx';
import { dropMetricSentences, selectKeyOutputs, topicNames } from './format';

// NWO evidence-based CV (Veni/Vidi/Vici pre-proposal): 2a academic profile and
// 2b up to 10 key outputs. The 2026 forms disallow h-/i10-/G-index, total
// citations of an author, JIF and journal rankings, rank words ("top",
// "prestigious", "leading"), totals of publications/grants/prizes, lists
// without context, and "et al." in references. Source: NWO Vidi 2026
// pre-proposal form, https://www.nwo.nl/sites/nwo/files/media-files/Vidi-2026-Pre-proposal-form.docx
export function buildNwo(
  data: Author,
  orcid: OrcidProfile | null,
  orcidId: string | undefined,
  _geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null,
): Paragraph[] {
  const p: Paragraph[] = [];
  const narrative = generateNarrativeParagraphs(data);

  p.push(...documentHeader('NWO EVIDENCE-BASED CV', data));
  if (orcidId) p.push(labelValueParagraph('ORCID', orcidId));
  const topics = topicNames(data);
  if (topics.length > 0) p.push(bodyParagraph(topics.join(' · ')));

  p.push(placeholderParagraph(
    'Draft for the NWO evidence-based CV. It leaves out author-level metrics and journal rankings, which NWO does not allow.' +
    'Grey text is guidance or a placeholder: complete or delete it, and check the word limits in your call’s form.'
  ));

  // 2a. Academic profile
  p.push(sectionHeading('2a. Academic Profile'));
  p.push(subHeading('General academic profile'));

  // Collaboration prose is left out: it is built from counts of papers and
  // co-authors, which reads as the publication totals NWO disallows.
  const methodsPara = narrative.find(n => n.includes('draws on') || n.includes('methods'));
  const evolutionPara = narrative.find(n =>
    n.includes('earlier work') || n.includes('shifted towards') || n.includes('consistently centered')
  );
  const profileParas = [narrative[0], methodsPara, evolutionPara]
    .filter((n, i, all): n is string => !!n && all.indexOf(n) === i)
    .map(dropMetricSentences)
    .filter(Boolean);
  for (const para of profileParas) p.push(bodyParagraph(para));

  for (const prompt of [
    '[Back each quality claim with evidence and explain how it exceeds what is usual in your international peer group.]',
    '[Refer to your key outputs by their number in 2b; other academic outputs may not be mentioned.]',
    '[Explain how the grant would contribute to your academic development and how your profile fits the research idea.]',
  ]) {
    p.push(placeholderParagraph(prompt));
  }

  p.push(subHeading('Leadership and mentorship (section 2a2 in Vidi and Vici)'));
  p.push(placeholderParagraph(
    '[Your vision and approach to leadership and mentorship: supervision, how you develop others, team contributions. ' +
    'Totals of supervised PhD candidates or students are allowed.]'
  ));

  const hasOrcidLists = !!(orcid?.educations?.length || orcid?.employments?.length || orcid?.fundings?.length || orcid?.distinctions?.length);
  if (hasOrcidLists) {
    p.push(subHeading('Reference material from your ORCID record'));
    p.push(placeholderParagraph(
      'NWO does not allow lists without context. Weave the items that matter into the narrative with an explanation, then delete this list.'
    ));
    if (orcid?.educations?.length) p.push(...educationEntries(orcid.educations));
    if (orcid?.employments?.length) p.push(...employmentEntries(orcid.employments));
    if (orcid?.fundings?.length) p.push(...fundingEntries(orcid.fundings));
    if (orcid?.distinctions?.length) p.push(...distinctionEntries(orcid.distinctions));
  }

  // 2b. Key output
  p.push(sectionHeading('2b. Key Output (max. 10)'));
  p.push(placeholderParagraph(
    'Starting point: your ten most-cited outputs on your profile. Replace them with the ten that best evidence your qualities ' +
    'and connect to your research idea; any output type counts. Outputs must be published, in print or unconditionally accepted.'
  ));
  p.push(...publicationEntries(selectKeyOutputs(data.publications), data.openAccess));
  p.push(placeholderParagraph(
    '[For each output: the output type, one to three quality indicators that relate to this output only (if you use its ' +
    'citation count, name the open database it came from, e.g. OpenAlex), and a motivation explaining its significance ' +
    'and your own contribution.]'
  ));

  p.push(footerParagraph('NWO Evidence-Based CV'));
  return p;
}
