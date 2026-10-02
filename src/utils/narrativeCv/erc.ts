import type { Paragraph } from 'docx';
import type { Author, CoAuthorGeoData } from '../../types/scholar';
import type { OrcidProfile } from '../../services/orcid';
import { generateNarrativeParagraphs } from '../../lib/narrative/paragraphs';
import {
  bodyParagraph, distinctionEntries, documentHeader, educationEntries, employmentEntries, footerParagraph,
  fundingEntries, labelValueParagraph, placeholderParagraph, publicationEntries, sectionHeading, subHeading,
} from './docx';
import { selectKeyOutputs, stripMarkdown } from './format';

// ERC Curriculum Vitae and Track Record (max. 4 pages per PI).
// Since the 2025 calls the ERC no longer uses PI profiles; the template has three
// sections: Personal details · Research achievements and peer recognition (up to
// ten research outputs) · Additional information. Sources:
// - ERC Work Programme 2027, "Curriculum Vitae (CV) and Track Record"
//   https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/wp-call/2027/wp_horizon-erc-2027_en.pdf
// - ERC Starting Grant application form, Part B1 template
//   https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/temp-form/af/af_he-erc-stg_en.pdf
// - ERC "How to write your proposal" (slide "CV and Track Record — since 2025 calls")
//   https://erc.europa.eu/system/files/2025-09/How_to_write_your_proposal.pdf
export function buildErc(
  data: Author,
  orcid: OrcidProfile | null,
  orcidId: string | undefined,
  _geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null,
): Paragraph[] {
  const p: Paragraph[] = [];
  const narrative = generateNarrativeParagraphs(data);

  p.push(...documentHeader('ERC CURRICULUM VITAE AND TRACK RECORD', data));
  p.push(placeholderParagraph(
    'Max. 4 pages, in Part B1 together with Part I of the scientific proposal. Grey text is guidance or a draft: ' +
    'complete or delete it before submission.'
  ));

  // 1. Personal details
  p.push(sectionHeading('Personal Details'));
  p.push(labelValueParagraph('Family name, First name', data.name));
  p.push(labelValueParagraph('Researcher unique identifier(s)', orcidId ? `ORCID ${orcidId}` : '[ORCID, Research ID, …]'));
  p.push(placeholderParagraph('URL for website: [add]'));

  p.push(subHeading('Education and key qualifications'));
  if (orcid?.educations?.length) {
    p.push(...educationEntries(orcid.educations));
  } else {
    p.push(placeholderParagraph('[DD/MM/YYYY PhD — faculty/department, university, country; name of PhD supervisor]'));
    p.push(placeholderParagraph('[YYYY Master — faculty/department, university, country]'));
  }

  p.push(subHeading('Current and previous positions'));
  if (orcid?.employments?.length) {
    p.push(...employmentEntries(orcid.employments));
  } else {
    if (data.affiliation) p.push(bodyParagraph(`Current: ${data.affiliation}`));
    p.push(placeholderParagraph('[YYYY–YYYY position — faculty/department, institution, country]'));
  }

  // 2. Research achievements and peer recognition
  p.push(sectionHeading('Research Achievements and Peer Recognition'));
  p.push(subHeading('Research achievements (up to ten research outputs)'));
  p.push(placeholderParagraph(
    'Candidate outputs from your profile. Choose up to ten that show how you advanced your field, ' +
    'with emphasis on recent work; any output type counts (preprints, data sets, software, patents…).'
  ));
  p.push(...publicationEntries(selectKeyOutputs(data.publications), data.openAccess, false));
  p.push(placeholderParagraph(
    '[Optional, per output: a short factual explanation of its significance, your role in producing it, ' +
    'and how it shows you can carry out the proposed project.]'
  ));

  p.push(subHeading('Peer recognition'));
  if (orcid?.distinctions?.length) p.push(...distinctionEntries(orcid.distinctions));
  p.push(placeholderParagraph(
    '[Selected examples: prizes, awards, fellowships, elected academy memberships, invited presentations to major ' +
    'conferences. Optionally explain why each matters.]'
  ));

  // 3. Additional information
  p.push(sectionHeading('Additional Information'));
  p.push(subHeading('Career breaks, diverse career paths and major life events'));
  p.push(placeholderParagraph(
    '[Optional: short factual explanation of career breaks, secondments, part-time work, time in other sectors, ' +
    'or major life events such as long-term illness.]'
  ));
  p.push(subHeading('Other contributions to the research community'));
  p.push(placeholderParagraph(
    '[Optional: particularly noteworthy contributions beyond your own research, e.g. leadership roles, ' +
    'responsibilities and commitments, with a short explanation.]'
  ));

  // Profile-derived material that has no slot in the ERC template; kept so the
  // researcher can mine it for the output explanations, then delete it.
  p.push(sectionHeading('Drafting Notes (not part of the ERC template — delete before submission)'));
  const notes = [
    narrative[0],
    narrative.find(n => n.includes('earlier work') || n.includes('shifted towards') || n.includes('consistently centered')),
    narrative.find(n => n.includes('co-authored') || n.includes('collaborator') || n.includes('single-authored')),
  ].filter((n, i, all): n is string => !!n && all.indexOf(n) === i);
  for (const note of notes) p.push(placeholderParagraph(stripMarkdown(note)));
  if (orcid?.fundings?.length) {
    p.push(placeholderParagraph(
      'Grants from your ORCID record. Ongoing grants and pending applications belong in the annex to Part II, not in the CV:'
    ));
    p.push(...fundingEntries(orcid.fundings));
  }

  p.push(footerParagraph('ERC CV and Track Record'));
  return p;
}
