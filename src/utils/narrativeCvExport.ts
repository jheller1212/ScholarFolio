import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TabStopPosition, TabStopType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Author, Publication, OpenAccessStats, CoAuthorGeoData } from '../types/scholar';
import { generateNarrativeParagraphs } from '../components/ResearcherNarrative';
import { fetchOrcidProfile } from '../services/orcid';
import type { OrcidProfile } from '../services/orcid';
import { findOpenAlexAuthor } from '../services/openalex/author-lookup';

const TEAL = '2D7D7D';
const DARK = '1E293B';
const GRAY = '64748B';
const PLACEHOLDER = '94A3B8';

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1');
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function selectKeyOutputs(publications: Publication[], limit = 10): Publication[] {
  return [...publications]
    .sort((a, b) => {
      const aFt = a.journalRanking?.ft50 ? 1 : 0;
      const bFt = b.journalRanking?.ft50 ? 1 : 0;
      if (aFt !== bFt) return bFt - aFt;
      const absOrder: Record<string, number> = { '4*': 5, '4': 4, '3': 3, '2': 2, '1': 1 };
      const aAbs = absOrder[a.journalRanking?.abs || ''] || 0;
      const bAbs = absOrder[b.journalRanking?.abs || ''] || 0;
      if (aAbs !== bAbs) return bAbs - aAbs;
      return b.citations - a.citations;
    })
    .slice(0, limit);
}

function isOA(pub: Publication, openAccess?: OpenAccessStats): boolean {
  if (!openAccess?.publicationOa) return false;
  const key = normalizeTitle(pub.title);
  const entry = openAccess.publicationOa[key];
  return !!entry && entry.status !== 'closed';
}

function orcidDateRange(startYear: number | null, endYear: number | null): string {
  if (!startYear) return '';
  return endYear ? `${startYear}–${endYear}` : `${startYear}–present`;
}

// --- Shared paragraph builders ---

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: TEAL } },
    run: { color: TEAL, bold: true, font: 'Calibri' },
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, font: 'Calibri', size: 21, color: DARK })],
    spacing: { before: 200, after: 60 },
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Calibri', size: 20, color: DARK })],
    spacing: { before: 40, after: 40 },
  });
}

function placeholderParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Calibri', size: 20, color: PLACEHOLDER, italics: true })],
    spacing: { before: 40, after: 40 },
  });
}

function labelValueParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, font: 'Calibri', size: 20, color: DARK }),
      new TextRun({ text: value, font: 'Calibri', size: 20, color: GRAY }),
    ],
    spacing: { before: 40, after: 40 },
  });
}

function educationEntries(eds: OrcidProfile['educations']): Paragraph[] {
  const result: Paragraph[] = [];
  for (const ed of eds) {
    const dateRange = orcidDateRange(ed.startYear, ed.endYear);
    const degreeLabel = [ed.degree, ed.department].filter(Boolean).join(' in ') || '(Degree not specified)';
    const locationParts = [ed.city, ed.country].filter(Boolean).join(', ');
    const institutionLine = [ed.institution, locationParts].filter(Boolean).join(', ');
    result.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: degreeLabel, bold: true, font: 'Calibri', size: 20, color: DARK }),
          ...(dateRange ? [
            new TextRun({ text: '\t', font: 'Calibri', size: 20 }),
            new TextRun({ text: dateRange, font: 'Calibri', size: 20, color: GRAY }),
          ] : []),
        ],
        spacing: { before: 80, after: 0 },
      }),
      new Paragraph({
        children: [new TextRun({ text: institutionLine, font: 'Calibri', size: 20, color: GRAY })],
        spacing: { before: 0, after: 40 },
      }),
    );
  }
  return result;
}

function employmentEntries(ems: OrcidProfile['employments']): Paragraph[] {
  const result: Paragraph[] = [];
  for (const em of ems) {
    const dateRange = orcidDateRange(em.startYear, em.endYear);
    const locationParts = [em.city, em.country].filter(Boolean).join(', ');
    const instLine = [em.institution, locationParts].filter(Boolean).join(', ');
    result.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: em.role || '(Role not specified)', bold: true, font: 'Calibri', size: 20, color: DARK }),
          ...(dateRange ? [
            new TextRun({ text: '\t', font: 'Calibri', size: 20 }),
            new TextRun({ text: dateRange, font: 'Calibri', size: 20, color: GRAY }),
          ] : []),
        ],
        spacing: { before: 80, after: 0 },
      }),
      new Paragraph({
        children: [new TextRun({ text: instLine, font: 'Calibri', size: 20, color: GRAY })],
        spacing: { before: 0, after: 40 },
      }),
    );
  }
  return result;
}

function fundingEntries(fus: OrcidProfile['fundings']): Paragraph[] {
  const result: Paragraph[] = [];
  for (const fu of fus) {
    const dateRange = orcidDateRange(fu.startYear, fu.endYear);
    result.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: fu.title || '(Untitled grant)', bold: true, font: 'Calibri', size: 20, color: DARK }),
          ...(dateRange ? [
            new TextRun({ text: '\t', font: 'Calibri', size: 20 }),
            new TextRun({ text: dateRange, font: 'Calibri', size: 20, color: GRAY }),
          ] : []),
        ],
        spacing: { before: 80, after: 0 },
      }),
      new Paragraph({
        children: [new TextRun({ text: fu.funder, font: 'Calibri', size: 20, color: GRAY })],
        spacing: { before: 0, after: 40 },
      }),
    );
  }
  return result;
}

function publicationEntries(
  pubs: Publication[], openAccess?: OpenAccessStats, includeCitations = false
): Paragraph[] {
  const result: Paragraph[] = [];
  for (let i = 0; i < pubs.length; i++) {
    const pub = pubs[i];
    const oaFlag = isOA(pub, openAccess) ? ' [OA]' : '';
    const authorsText = pub.authors.slice(0, 6).join(', ') + (pub.authors.length > 6 ? ' et al.' : '');
    const venue = pub.venue ? pub.venue.replace(/,.*$/, '').trim() : '';

    const metaParts = [venue, pub.year ? String(pub.year) : ''].filter(Boolean);
    if (includeCitations && pub.citations > 0) {
      metaParts.push(`${pub.citations} citation${pub.citations !== 1 ? 's' : ''}`);
    }

    result.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, font: 'Calibri', size: 19, color: DARK }),
          new TextRun({ text: `${pub.title}${oaFlag}`, bold: true, font: 'Calibri', size: 19, color: DARK }),
        ],
        spacing: { before: 100, after: 0 },
      }),
      new Paragraph({
        children: [new TextRun({ text: authorsText, font: 'Calibri', size: 18, color: GRAY })],
        spacing: { before: 0, after: 0 },
        indent: { left: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: metaParts.join(' · '), font: 'Calibri', size: 17, color: GRAY })],
        spacing: { before: 0, after: 60 },
        indent: { left: 200 },
      }),
    );
  }
  return result;
}

function footerParagraph(label: string): Paragraph {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return new Paragraph({
    children: [new TextRun({
      text: `Generated by ScholarFolio · scholarfolio.org · ${label} · ${dateStr}`,
      font: 'Calibri', size: 14, color: PLACEHOLDER,
    })],
    spacing: { before: 400 },
    alignment: AlignmentType.CENTER,
  });
}

function topicString(data: Author): string {
  return data.topics.map(t =>
    typeof t.name === 'object' ? (t.name as { title?: string }).title || '' : String(t.name)
  ).filter(Boolean).join(' · ');
}

// ============================================================
// Main export
// ============================================================

export async function exportNarrativeCv(
  data: Author,
  format: 'nwo' | 'erc',
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null
): Promise<void> {
  let resolvedOrcidId = data.openAccess?.orcid;
  if (!resolvedOrcidId) {
    const author = await findOpenAlexAuthor(data.name, data.affiliation);
    resolvedOrcidId = author?.orcid;
  }
  const orcid = resolvedOrcidId ? await fetchOrcidProfile(resolvedOrcidId) : null;

  const children = format === 'nwo'
    ? buildNwo(data, orcid, resolvedOrcidId, geoData)
    : buildErc(data, orcid, resolvedOrcidId, geoData);

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1100, bottom: 1100, left: 1200, right: 1200 } },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const prefix = format === 'nwo' ? 'NWO_EBCV' : 'ERC_CV';
  saveAs(blob, `ScholarFolio_${prefix}_${safeName}_${dateStr}.docx`);
}

// ============================================================
// NWO Evidence-Based CV
// No h-index, no JIF, no citation counts per NWO policy
// ============================================================

function buildNwo(
  data: Author,
  orcid: OrcidProfile | null,
  orcidId: string | undefined,
  _geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null,
): Paragraph[] {
  const p: Paragraph[] = [];
  const narrative = generateNarrativeParagraphs(data);

  // Header
  p.push(new Paragraph({
    children: [new TextRun({ text: 'NWO EVIDENCE-BASED CV', font: 'Calibri', size: 16, color: PLACEHOLDER })],
    spacing: { after: 100 },
  }));
  p.push(new Paragraph({
    children: [new TextRun({ text: data.name, bold: true, font: 'Calibri', size: 36, color: DARK })],
    spacing: { after: 60 },
  }));
  if (data.affiliation) {
    p.push(new Paragraph({
      children: [new TextRun({ text: data.affiliation, font: 'Calibri', size: 22, color: GRAY })],
      spacing: { after: 60 },
    }));
  }
  if (orcidId) p.push(labelValueParagraph('ORCID', orcidId));
  if (data.topics.length > 0) {
    p.push(new Paragraph({
      children: [new TextRun({ text: topicString(data), font: 'Calibri', size: 18, color: GRAY })],
      spacing: { after: 200 },
    }));
  }

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
    for (const dist of orcid.distinctions) {
      const yearStr = dist.year ? ` (${dist.year})` : '';
      p.push(bodyParagraph(`${dist.title} — ${dist.organization}${yearStr}`));
    }
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

// ============================================================
// ERC CV & Track Record
// No JIF, but citation counts are acceptable as evidence
// ============================================================

function buildErc(
  data: Author,
  orcid: OrcidProfile | null,
  orcidId: string | undefined,
  _geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null,
): Paragraph[] {
  const p: Paragraph[] = [];
  const narrative = generateNarrativeParagraphs(data);

  // Header
  p.push(new Paragraph({
    children: [new TextRun({ text: 'ERC CV & TRACK RECORD', font: 'Calibri', size: 16, color: PLACEHOLDER })],
    spacing: { after: 100 },
  }));
  p.push(new Paragraph({
    children: [new TextRun({ text: data.name, bold: true, font: 'Calibri', size: 36, color: DARK })],
    spacing: { after: 60 },
  }));
  if (data.affiliation) {
    p.push(new Paragraph({
      children: [new TextRun({ text: data.affiliation, font: 'Calibri', size: 22, color: GRAY })],
      spacing: { after: 200 },
    }));
  }

  p.push(placeholderParagraph(
    'ERC CV & Track Record: target 4 pages. Complete placeholder sections before submission. ' +
    'Do not include journal impact factors per ERC guidelines. Citation counts are acceptable as evidence of impact.'
  ));

  // Section A: Personal Information
  p.push(sectionHeading('A. Personal Information'));
  p.push(labelValueParagraph('Name', data.name));
  if (data.affiliation) p.push(labelValueParagraph('Current affiliation', data.affiliation));
  if (data.topics.length > 0) {
    const topicNames = data.topics.map(t =>
      typeof t.name === 'object' ? (t.name as { title?: string }).title || '' : String(t.name)
    ).filter(Boolean);
    p.push(labelValueParagraph('Research areas', topicNames.slice(0, 5).join(', ')));
  }
  if (orcidId) p.push(labelValueParagraph('ORCID', orcidId));
  p.push(placeholderParagraph('[Add: nationality, date of birth (if required by call)]'));

  // Section B: Education
  p.push(sectionHeading('B. Education & Key Qualifications'));
  if (orcid?.educations?.length) {
    p.push(...educationEntries(orcid.educations));
    p.push(placeholderParagraph('[Add: thesis title or additional qualifications if relevant]'));
  } else {
    p.push(placeholderParagraph('[PhD degree, institution, year, thesis title]'));
    p.push(placeholderParagraph('[MSc / MA degree, institution, year]'));
    p.push(placeholderParagraph('[BSc / BA degree, institution, year]'));
  }

  // Section C: Positions
  p.push(sectionHeading('C. Current and Previous Positions'));
  if (orcid?.employments?.length) {
    p.push(...employmentEntries(orcid.employments));
    p.push(placeholderParagraph('[Add: visiting appointments or industry roles if relevant]'));
  } else {
    if (data.affiliation) p.push(bodyParagraph(`Current: ${data.affiliation}`));
    p.push(placeholderParagraph('[Add: previous positions with institution name, role, and dates]'));
  }

  // Section D: Research Achievements
  p.push(sectionHeading('D. Research Achievements & Peer Recognition'));

  p.push(subHeading('Career summary'));
  if (narrative[0]) p.push(bodyParagraph(stripMarkdown(narrative[0])));

  const impactPara = narrative.find(n =>
    n.includes('h-index') || n.includes('citations') || n.includes('most cited')
  );
  if (impactPara) p.push(bodyParagraph(stripMarkdown(impactPara)));

  const trendPara = narrative.find(n =>
    n.includes('publication output') || n.includes('publication pace') || n.includes('publication rate')
  );
  if (trendPara) p.push(bodyParagraph(stripMarkdown(trendPara)));

  p.push(subHeading('Grants & funding'));
  if (orcid?.fundings?.length) {
    p.push(...fundingEntries(orcid.fundings));
    p.push(placeholderParagraph('[Add: funding amounts where relevant]'));
  } else {
    p.push(placeholderParagraph('[List research grants received, funding body, amount, and period]'));
  }

  p.push(subHeading('Awards & prizes'));
  if (orcid?.distinctions?.length) {
    for (const dist of orcid.distinctions) {
      const yearStr = dist.year ? ` (${dist.year})` : '';
      p.push(bodyParagraph(`${dist.title} — ${dist.organization}${yearStr}`));
    }
  } else {
    p.push(placeholderParagraph('[List academic awards, best paper prizes, teaching awards, etc.]'));
  }

  p.push(subHeading('Editorial & professional roles'));
  p.push(placeholderParagraph('[List editorial board memberships, conference roles, society memberships]'));

  p.push(subHeading('Invited talks'));
  p.push(placeholderParagraph('[List keynotes, invited talks, and conference presentations (last 5 years)]'));

  p.push(subHeading('Media & societal impact'));
  p.push(placeholderParagraph('[Describe policy impact, media coverage, consultancy, or knowledge transfer]'));

  // Section E: Publications
  p.push(sectionHeading('E. Selected Publications & Outputs (max. 10)'));
  p.push(placeholderParagraph(
    'Selected publications ranked by journal prestige and citation impact. Journal impact factors are not included per ERC guidelines.'
  ));

  const keyOutputs = selectKeyOutputs(data.publications);
  p.push(...publicationEntries(keyOutputs, data.openAccess, true));
  p.push(placeholderParagraph('[For each output, add a brief narrative explaining how it advanced knowledge in the field.]'));

  // Section F: Narrative Track Record
  p.push(sectionHeading('F. Narrative on Track Record'));

  p.push(subHeading('Research evolution'));
  const evolutionPara = narrative.find(n =>
    n.includes('earlier work') || n.includes('shifted towards') || n.includes('consistently centered')
  );
  if (evolutionPara) {
    p.push(bodyParagraph(stripMarkdown(evolutionPara)));
  } else {
    p.push(placeholderParagraph('[Describe how your research has evolved and where it is headed.]'));
  }

  p.push(subHeading('Research methods & approach'));
  const methodsPara = narrative.find(n => n.includes('draws on') || n.includes('methods'));
  if (methodsPara && methodsPara !== narrative[0]) {
    p.push(bodyParagraph(stripMarkdown(methodsPara)));
  } else {
    p.push(placeholderParagraph('[Describe the methods and approaches that characterise your research.]'));
  }

  p.push(subHeading('Research themes'));
  if (data.topics.length > 0) {
    const topicNames = data.topics.map(t =>
      typeof t.name === 'object' ? (t.name as { title?: string }).title || '' : String(t.name)
    ).filter(Boolean);
    p.push(bodyParagraph('Core research themes: ' + topicNames.slice(0, 6).join(', ') + '.'));
  }
  p.push(placeholderParagraph('[Expand on themes and their significance to the proposed project.]'));

  p.push(subHeading('Collaboration & international profile'));
  const collabPara = narrative.find(n =>
    n.includes('co-authored') || n.includes('collaborator') || n.includes('single-authored')
  );
  if (collabPara) p.push(bodyParagraph(stripMarkdown(collabPara)));
  p.push(placeholderParagraph('[Add: international collaborations, research networks, and mobility.]'));

  p.push(footerParagraph('ERC CV & Track Record'));
  return p;
}
