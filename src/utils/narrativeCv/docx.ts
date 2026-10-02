// Shared Word (docx) paragraph builders for the narrative CV formats.

import {
  Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TabStopPosition, TabStopType,
} from 'docx';
import type { Author, OpenAccessStats, Publication } from '../../types/scholar';
import type { OrcidProfile } from '../../services/orcid';
import { formatAuthors, isOA, orcidDateRange } from './format';

export const TEAL = '2D7D7D';
export const DARK = '1E293B';
export const GRAY = '64748B';
export const PLACEHOLDER = '94A3B8';


export function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: TEAL } },
    run: { color: TEAL, bold: true, font: 'Calibri' },
  });
}

export function subHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, font: 'Calibri', size: 21, color: DARK })],
    spacing: { before: 200, after: 60 },
  });
}

export function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Calibri', size: 20, color: DARK })],
    spacing: { before: 40, after: 40 },
  });
}

export function placeholderParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Calibri', size: 20, color: PLACEHOLDER, italics: true })],
    spacing: { before: 40, after: 40 },
  });
}

export function labelValueParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, font: 'Calibri', size: 20, color: DARK }),
      new TextRun({ text: value, font: 'Calibri', size: 20, color: GRAY }),
    ],
    spacing: { before: 40, after: 40 },
  });
}

export function educationEntries(eds: OrcidProfile['educations']): Paragraph[] {
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

export function employmentEntries(ems: OrcidProfile['employments']): Paragraph[] {
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

export function fundingEntries(fus: OrcidProfile['fundings']): Paragraph[] {
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

interface PublicationEntryOptions {
  includeCitations?: boolean;
  /** Cap the author list with "et al."; omit for the full list (NWO requires it). */
  maxAuthors?: number;
}

export function publicationEntries(
  pubs: Publication[],
  openAccess?: OpenAccessStats,
  { includeCitations = false, maxAuthors }: PublicationEntryOptions = {},
): Paragraph[] {
  const result: Paragraph[] = [];
  for (let i = 0; i < pubs.length; i++) {
    const pub = pubs[i];
    const oaFlag = isOA(pub, openAccess) ? ' [OA]' : '';
    const authorsText = formatAuthors(pub.authors, maxAuthors);
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

export function footerParagraph(label: string): Paragraph {
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


export function distinctionEntries(dists: OrcidProfile['distinctions']): Paragraph[] {
  return dists.map(dist => {
    const yearStr = dist.year ? ` (${dist.year})` : '';
    return bodyParagraph(`${dist.title} — ${dist.organization}${yearStr}`);
  });
}

/** Small grey label, name and affiliation at the top of every format. */
export function documentHeader(label: string, data: Author): Paragraph[] {
  const p = [
    new Paragraph({
      children: [new TextRun({ text: label, font: 'Calibri', size: 16, color: PLACEHOLDER })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.name, bold: true, font: 'Calibri', size: 36, color: DARK })],
      spacing: { after: 60 },
    }),
  ];
  if (data.affiliation) {
    p.push(new Paragraph({
      children: [new TextRun({ text: data.affiliation, font: 'Calibri', size: 22, color: GRAY })],
      spacing: { after: 200 },
    }));
  }
  return p;
}
