import type { Paragraph } from 'docx';
import type { Author, CoAuthorGeoData } from '../../types/scholar';
import type { OrcidProfile } from '../../services/orcid';
import { generateNarrativeParagraphs } from '../../lib/narrative/paragraphs';
import {
  bodyParagraph, distinctionEntries, documentHeader, educationEntries, employmentEntries, footerParagraph,
  fundingEntries, labelValueParagraph, placeholderParagraph, publicationEntries, sectionHeading, subHeading,
} from './docx';
import { selectKeyOutputs, stripMarkdown, topicNames } from './format';

// ============================================================
// MSCA Postdoctoral Fellowship (Part B2 - CV)
// Citation counts acceptable, no JIF requirement
// ============================================================

export function buildMsca(
  data: Author,
  orcid: OrcidProfile | null,
  orcidId: string | undefined,
  _geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null,
): Paragraph[] {
  const p: Paragraph[] = [];
  const narrative = generateNarrativeParagraphs(data);

  p.push(...documentHeader('MSCA POSTDOCTORAL FELLOWSHIP — CV (Part B2)', data));

  p.push(placeholderParagraph(
    'MSCA Postdoctoral Fellowship CV. No strict page limit for Part B2, but keep concise. ' +
    'Complete placeholder sections before submission.'
  ));

  // Personal details
  p.push(sectionHeading('Personal Details'));
  p.push(labelValueParagraph('Name', data.name));
  if (data.affiliation) p.push(labelValueParagraph('Current affiliation', data.affiliation));
  if (orcidId) p.push(labelValueParagraph('ORCID', orcidId));
  if (data.topics.length > 0) {
    p.push(labelValueParagraph('Research areas', topicNames(data).slice(0, 5).join(', ')));
  }
  p.push(placeholderParagraph('[Add: nationality, date of birth, contact details]'));

  // Education
  p.push(sectionHeading('Education'));
  if (orcid?.educations?.length) {
    p.push(...educationEntries(orcid.educations));
  } else {
    p.push(placeholderParagraph('[PhD degree, institution, year, thesis title]'));
    p.push(placeholderParagraph('[MSc / MA degree, institution, year]'));
  }

  // Research experience
  p.push(sectionHeading('Research Experience & Positions'));
  if (orcid?.employments?.length) {
    p.push(...employmentEntries(orcid.employments));
  } else {
    if (data.affiliation) p.push(bodyParagraph(`Current: ${data.affiliation}`));
    p.push(placeholderParagraph('[Add: previous research positions with dates]'));
  }

  // Publications
  p.push(sectionHeading('Publications'));
  if (narrative[0]) p.push(bodyParagraph(stripMarkdown(narrative[0])));

  p.push(subHeading('Selected publications'));
  const keyOutputs = selectKeyOutputs(data.publications);
  p.push(...publicationEntries(keyOutputs, data.openAccess, true));

  // Grants & awards
  p.push(sectionHeading('Grants, Fellowships & Awards'));
  if (orcid?.fundings?.length) {
    p.push(...fundingEntries(orcid.fundings));
  } else {
    p.push(placeholderParagraph('[List research grants and fellowships received]'));
  }
  if (orcid?.distinctions?.length) {
    p.push(subHeading('Awards'));
    p.push(...distinctionEntries(orcid.distinctions));
  } else {
    p.push(placeholderParagraph('[List academic awards and prizes]'));
  }

  // Supervision & teaching
  p.push(sectionHeading('Supervision & Teaching'));
  p.push(placeholderParagraph('[List students supervised (PhD, MSc), courses taught, mentoring activities]'));

  // Institutional responsibilities
  p.push(sectionHeading('Institutional Responsibilities & Service'));
  p.push(placeholderParagraph('[List editorial board memberships, reviewing activities, conference organisation]'));

  // International mobility
  p.push(sectionHeading('International Mobility & Collaboration'));
  const collabPara = narrative.find(n =>
    n.includes('co-authored') || n.includes('collaborator') || n.includes('single-authored')
  );
  if (collabPara) p.push(bodyParagraph(stripMarkdown(collabPara)));
  p.push(placeholderParagraph('[Describe international research stays, mobility, and collaboration networks]'));

  // Transferable skills & career breaks
  p.push(sectionHeading('Transferable Skills & Career Breaks'));
  p.push(placeholderParagraph('[Describe transferable skills (project management, outreach, industry collaboration)]'));
  p.push(placeholderParagraph('[If applicable, explain any career breaks, parental leave, or non-standard career paths]'));

  p.push(footerParagraph('MSCA Postdoctoral Fellowship CV'));
  return p;
}
