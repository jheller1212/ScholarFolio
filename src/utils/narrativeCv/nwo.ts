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
// NWO Evidence-Based CV
// No h-index, no JIF, no citation counts per NWO policy
// ============================================================

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
    'Note: Per NWO policy, this CV does not include Journal Impact Factors or h-indices. Complete placeholder sections before submission.'
  ));

  // Section 1: Academic Profile
  p.push(sectionHeading('1. Academic Profile'));

  const stripMetrics = (text: string): string => {
    let cleaned = stripMarkdown(text);
    cleaned = cleaned.replace(/,?\s*with an h-index of \d+/gi, '');
    cleaned = cleaned.replace(/\s*Their h-index is \d+\.\s*/gi, ' ');
    return cleaned.trim();
  };

  if (narrative[0]) p.push(bodyParagraph(stripMetrics(narrative[0])));

  const methodsPara = narrative.find(n => n.includes('draws on') || n.includes('methods'));
  if (methodsPara && methodsPara !== narrative[0]) p.push(bodyParagraph(stripMetrics(methodsPara)));

  const evolutionPara = narrative.find(n =>
    n.includes('earlier work') || n.includes('shifted towards') || n.includes('consistently centered')
  );
  if (evolutionPara) p.push(bodyParagraph(stripMetrics(evolutionPara)));

  const collabPara = narrative.find(n =>
    n.includes('co-authored') || n.includes('collaborator') || n.includes('single-authored')
  );
  if (collabPara) p.push(bodyParagraph(stripMetrics(collabPara)));

  // ORCID sections
  if (orcid?.educations?.length) {
    p.push(subHeading('Education'));
    p.push(...educationEntries(orcid.educations));
  }
  if (orcid?.employments?.length) {
    p.push(subHeading('Academic & Professional Positions'));
    p.push(...employmentEntries(orcid.employments));
  }
  if (orcid?.fundings?.length) {
    p.push(subHeading('Grants & Funding'));
    p.push(...fundingEntries(orcid.fundings));
  }
  if (orcid?.distinctions?.length) {
    p.push(subHeading('Awards & Distinctions'));
    p.push(...distinctionEntries(orcid.distinctions));
  }

  p.push(subHeading('Additional information to complete'));
  for (const prompt of [
    '[Describe your most significant scientific achievements and their broader societal relevance.]',
    '[Explain how your research profile fits the NWO programme or call you are applying to.]',
    '[Describe any scientific leadership roles, editorial boards, or programme committees.]',
    ...((!orcid?.fundings?.length)
      ? ['[List any prizes, grants, or fellowships received (e.g. NWO Veni/Vidi/Vici, ERC, Marie Curie).]']
      : []),
    '[Add information about research integrity, open science practices, and data management.]',
  ]) {
    p.push(placeholderParagraph(prompt));
  }

  // Section 2: Key Outputs
  p.push(sectionHeading('2. Key Outputs (max. 10)'));
  p.push(placeholderParagraph(
    'Selected publications ranked by journal prestige and contribution significance. Per NWO policy, no Journal Impact Factors or citation counts are included.'
  ));

  const keyOutputs = selectKeyOutputs(data.publications);
  p.push(...publicationEntries(keyOutputs, data.openAccess, false));
  p.push(placeholderParagraph(
    '[For each output, add a brief narrative (1-2 sentences) explaining its significance and contribution to the field.]'
  ));

  p.push(footerParagraph('NWO Evidence-Based CV'));
  return p;
}
