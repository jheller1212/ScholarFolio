import jsPDF from 'jspdf';
import type { Author, Publication, OpenAccessStats, CoAuthorGeoData } from '../types/scholar';
import { generateNarrativeParagraphs } from '../components/ResearcherNarrative';
import { fetchOrcidProfile } from '../services/orcid';
import type { OrcidProfile } from '../services/orcid';
import { findOpenAlexAuthor } from '../services/openalex/author-lookup';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18; // margin
const CW = PAGE_W - M * 2;
const TEAL = [45, 125, 125] as const;
const DARK = [30, 41, 59] as const;
const GRAY = [100, 116, 139] as const;
const LIGHT_GRAY = [203, 213, 225] as const;
const PLACEHOLDER_GRAY = [148, 163, 184] as const; // #94a3b8

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

export async function exportNarrativeCv(
  data: Author,
  format: 'nwo' | 'erc',
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null
): Promise<void> {
  let orcidId = data.openAccess?.orcid;
  // Fallback: if ORCID not in cached OA stats, try fetching from OpenAlex directly
  if (!orcidId) {
    const author = await findOpenAlexAuthor(data.name, data.affiliation);
    orcidId = author?.orcid;
  }
  const orcid = orcidId ? await fetchOrcidProfile(orcidId) : null;

  if (format === 'nwo') {
    exportNwo(data, geoData, orcid);
  } else {
    exportErc(data, geoData, orcid);
  }
}

// ============================================================
// ORCID formatting helpers
// ============================================================

function orcidDateRange(startYear: number | null, endYear: number | null): string {
  if (!startYear) return '';
  return endYear ? `${startYear}–${endYear}` : `${startYear}–present`;
}

// ============================================================
// NWO Evidence-Based CV
// ============================================================

function exportNwo(
  data: Author,
  _geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null,
  orcid?: OrcidProfile | null
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;

  const setColor = (c: readonly [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: readonly [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - 18) {
      doc.addPage();
      drawPageHeader(doc, setFill);
      y = M + 4;
    }
  };

  const sectionTitle = (text: string) => {
    ensureSpace(14);
    setColor(TEAL);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(text, M, y);
    y += 2;
    doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.setLineWidth(0.4);
    doc.line(M, y, PAGE_W - M, y);
    y += 5;
    setColor(DARK);
  };

  const bodyText = (text: string, indent = 0) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(DARK);
    const lines = doc.splitTextToSize(text, CW - indent);
    for (const line of lines) {
      ensureSpace(4);
      doc.text(line, M + indent, y);
      y += 4;
    }
  };

  const placeholderText = (text: string) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    setColor(PLACEHOLDER_GRAY);
    const lines = doc.splitTextToSize(text, CW);
    for (const line of lines) {
      ensureSpace(4);
      doc.text(line, M, y);
      y += 4;
    }
    y += 1;
  };

  // === COVER HEADER ===
  drawPageHeader(doc, setFill);
  y = M + 4;

  // Format label
  setColor(PLACEHOLDER_GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('NWO EVIDENCE-BASED CV', M, y);
  y += 6;

  // Name
  setColor(DARK);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.name, M, y);
  y += 7;

  // Affiliation
  if (data.affiliation) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    doc.text(data.affiliation, M, y);
    y += 5;
  }

  // Key stats inline
  const stats = [
    `h-index: ${data.hIndex}`,
    `Citations: ${data.totalCitations.toLocaleString()}`,
    `Publications: ${data.publications.length}`,
  ];
  doc.setFontSize(8);
  setColor(TEAL);
  doc.text(stats.join('   |   '), M, y);
  y += 8;

  // Topics
  if (data.topics.length > 0) {
    const topicNames = data.topics.map(t =>
      typeof t.name === 'object' ? (t.name as { title?: string }).title || '' : String(t.name)
    ).filter(Boolean);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    const topicLine = topicNames.join('  ·  ');
    const tLines = doc.splitTextToSize(topicLine, CW);
    doc.text(tLines, M, y);
    y += tLines.length * 3.5 + 6;
  }

  // Divider
  doc.setDrawColor(LIGHT_GRAY[0], LIGHT_GRAY[1], LIGHT_GRAY[2]);
  doc.setLineWidth(0.3);
  doc.line(M, y, PAGE_W - M, y);
  y += 8;

  // ==============================
  // SECTION 1: ACADEMIC PROFILE
  // ==============================
  sectionTitle('1. Academic Profile');

  const narrativeParagraphs = generateNarrativeParagraphs(data);

  // Career overview
  if (narrativeParagraphs[0]) {
    bodyText(stripMarkdown(narrativeParagraphs[0]));
    y += 2;
  }

  // Research methods — from paragraph that usually mentions "draws on"
  const methodsPara = narrativeParagraphs.find(p => p.includes('draws on') || p.includes('methods'));
  if (methodsPara && methodsPara !== narrativeParagraphs[0]) {
    bodyText(stripMarkdown(methodsPara));
    y += 2;
  }

  // Research evolution
  const evolutionPara = narrativeParagraphs.find(p =>
    p.includes('earlier work') || p.includes('shifted towards') || p.includes('consistently centered')
  );
  if (evolutionPara) {
    bodyText(stripMarkdown(evolutionPara));
    y += 2;
  }

  // Collaboration profile
  const collabPara = narrativeParagraphs.find(p =>
    p.includes('co-authored') || p.includes('collaborator') || p.includes('single-authored')
  );
  if (collabPara) {
    bodyText(stripMarkdown(collabPara));
    y += 2;
  }

  // Impact paragraph
  const impactPara = narrativeParagraphs.find(p =>
    p.includes('h-index') || p.includes('citations') || p.includes('most cited')
  );
  if (impactPara) {
    bodyText(stripMarkdown(impactPara));
    y += 2;
  }

  y += 3;

  // --- ORCID: Education ---
  if (orcid?.educations && orcid.educations.length > 0) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    doc.text('Education', M, y);
    y += 5;
    for (const ed of orcid.educations) {
      ensureSpace(10);
      const dateRange = orcidDateRange(ed.startYear, ed.endYear);
      const degreeLabel = [ed.degree, ed.department].filter(Boolean).join(' in ');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setColor(DARK);
      doc.text(degreeLabel, M, y);
      if (dateRange) {
        doc.setFont('helvetica', 'normal');
        setColor(GRAY);
        doc.text(dateRange, PAGE_W - M, y, { align: 'right' });
      }
      y += 4;
      const locationParts = [ed.city, ed.country].filter(Boolean).join(', ');
      const institutionLine = [ed.institution, locationParts].filter(Boolean).join(', ');
      bodyText(institutionLine, 0);
      y += 1;
    }
    y += 2;
  }

  // --- ORCID: Employment ---
  if (orcid?.employments && orcid.employments.length > 0) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    doc.text('Academic & Professional Positions', M, y);
    y += 5;
    for (const em of orcid.employments) {
      ensureSpace(10);
      const dateRange = orcidDateRange(em.startYear, em.endYear);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setColor(DARK);
      doc.text(em.role || '(Role not specified)', M, y);
      if (dateRange) {
        doc.setFont('helvetica', 'normal');
        setColor(GRAY);
        doc.text(dateRange, PAGE_W - M, y, { align: 'right' });
      }
      y += 4;
      const locationParts = [em.city, em.country].filter(Boolean).join(', ');
      const instLine = [em.institution, locationParts].filter(Boolean).join(', ');
      bodyText(instLine, 0);
      y += 1;
    }
    y += 2;
  }

  // --- ORCID: Grants & Funding ---
  if (orcid?.fundings && orcid.fundings.length > 0) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    doc.text('Grants & Funding', M, y);
    y += 5;
    for (const fu of orcid.fundings) {
      ensureSpace(10);
      const dateRange = orcidDateRange(fu.startYear, fu.endYear);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setColor(DARK);
      const titleLines = doc.splitTextToSize(fu.title || '(Untitled grant)', CW - 30);
      doc.text(titleLines[0], M, y);
      if (dateRange) {
        doc.setFont('helvetica', 'normal');
        setColor(GRAY);
        doc.text(dateRange, PAGE_W - M, y, { align: 'right' });
      }
      y += 4;
      for (let i = 1; i < titleLines.length; i++) {
        ensureSpace(4);
        doc.setFont('helvetica', 'bold');
        setColor(DARK);
        doc.text(titleLines[i], M, y);
        y += 4;
      }
      bodyText(fu.funder, 0);
      y += 1;
    }
    y += 2;
  }

  // --- ORCID: Distinctions ---
  if (orcid?.distinctions && orcid.distinctions.length > 0) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    doc.text('Awards & Distinctions', M, y);
    y += 5;
    for (const dist of orcid.distinctions) {
      ensureSpace(6);
      const yearStr = dist.year ? ` (${dist.year})` : '';
      bodyText(`${dist.title} — ${dist.organization}${yearStr}`);
    }
    y += 2;
  }

  // NWO-specific placeholder prompts
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  setColor(DARK);
  doc.text('Additional information to complete manually:', M, y);
  y += 5;

  const nwoPrompts = [
    '[Describe your most significant scientific achievements and their broader societal relevance.]',
    '[Explain how your research profile fits the NWO programme or call you are applying to.]',
    '[Describe any scientific leadership roles, editorial boards, or programme committees you have held.]',
    ...((!orcid?.fundings || orcid.fundings.length === 0)
      ? ['[List any prizes, grants, or fellowships received (e.g. NWO Veni/Vidi/Vici, ERC, Marie Curie).]']
      : []),
    '[Add information about research integrity, open science practices, and data management.]',
  ];
  for (const prompt of nwoPrompts) {
    placeholderText(prompt);
  }

  y += 4;

  // ==============================
  // SECTION 2: KEY OUTPUTS
  // ==============================
  sectionTitle('2. Key Outputs (max. 10)');

  const keyOutputs = selectKeyOutputs(data.publications);
  const hasOaData = !!data.openAccess?.publicationOa;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  setColor(GRAY);
  doc.text(
    'Publications ranked by journal prestige (FT50, then ABS rating) and citation count. Max. 10 shown.',
    M, y
  );
  y += 5;

  if (hasOaData) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    setColor(TEAL);
    doc.text('[OA] = Open Access', M, y);
    y += 4;
  }

  for (let i = 0; i < keyOutputs.length; i++) {
    const pub = keyOutputs[i];
    ensureSpace(18);

    const oaFlag = hasOaData && isOA(pub, data.openAccess) ? ' [OA]' : '';

    // Number + title
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    const titleText = `${i + 1}. ${pub.title}${oaFlag}`;
    const titleLines = doc.splitTextToSize(titleText, CW);
    for (const line of titleLines) {
      ensureSpace(4);
      doc.text(line, M, y);
      y += 4;
    }

    // Authors
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    const authorsText = pub.authors.slice(0, 6).join(', ') + (pub.authors.length > 6 ? ' et al.' : '');
    const aLines = doc.splitTextToSize(authorsText, CW);
    for (const line of aLines) {
      ensureSpace(4);
      doc.text(line, M + 4, y);
      y += 3.5;
    }

    // Venue, year, citations, ranking badges
    const venue = pub.venue ? pub.venue.replace(/,.*$/, '').trim() : '';
    const rankingParts: string[] = [];
    if (pub.journalRanking?.ft50) rankingParts.push('FT50');
    if (pub.journalRanking?.abs) rankingParts.push(`ABS ${pub.journalRanking.abs}`);
    if (pub.journalRanking?.abdc) rankingParts.push(`ABDC ${pub.journalRanking.abdc}`);
    if (pub.journalRanking?.sjr) rankingParts.push(`SJR ${pub.journalRanking.sjr}`);

    const metaParts = [
      venue,
      pub.year ? String(pub.year) : '',
      pub.citations > 0 ? `${pub.citations} citation${pub.citations !== 1 ? 's' : ''}` : '',
    ].filter(Boolean);
    const metaLine = metaParts.join('  ·  ');

    doc.setFontSize(7.5);
    setColor(GRAY);
    doc.text(metaLine, M + 4, y);

    if (rankingParts.length > 0) {
      const metaW = doc.getTextWidth(metaLine);
      setColor(TEAL);
      doc.text('  ' + rankingParts.join(' · '), M + 4 + metaW, y);
    }

    y += 6;
  }

  addFooter(doc, 'NWO Evidence-Based CV');
  const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`ScholarFolio_NWO_CV_${safeName}_${dateStr}.pdf`);
}

// ============================================================
// ERC CV & Track Record
// ============================================================

function exportErc(
  data: Author,
  _geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null,
  orcid?: OrcidProfile | null
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;
  let pageCount = 1;

  const setColor = (c: readonly [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: readonly [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - 18) {
      doc.addPage();
      pageCount++;
      drawPageHeader(doc, setFill);
      y = M + 4;
    }
  };

  const sectionTitle = (text: string) => {
    ensureSpace(14);
    setColor(TEAL);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(text, M, y);
    y += 2;
    doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.setLineWidth(0.4);
    doc.line(M, y, PAGE_W - M, y);
    y += 5;
    setColor(DARK);
  };

  const subHeading = (text: string) => {
    ensureSpace(8);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    doc.text(text, M, y);
    y += 5;
  };

  const bodyText = (text: string, indent = 0) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(DARK);
    const lines = doc.splitTextToSize(text, CW - indent);
    for (const line of lines) {
      ensureSpace(4);
      doc.text(line, M + indent, y);
      y += 4;
    }
  };

  const placeholderText = (text: string, indent = 0) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    setColor(PLACEHOLDER_GRAY);
    const lines = doc.splitTextToSize(text, CW - indent);
    for (const line of lines) {
      ensureSpace(4);
      doc.text(line, M + indent, y);
      y += 4;
    }
    y += 1;
  };

  const labelValue = (label: string, value: string) => {
    ensureSpace(5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    doc.text(label + ': ', M, y);
    const labelW = doc.getTextWidth(label + ': ');
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    const valLines = doc.splitTextToSize(value, CW - labelW);
    doc.text(valLines[0], M + labelW, y);
    y += 4;
    for (let i = 1; i < valLines.length; i++) {
      ensureSpace(4);
      doc.text(valLines[i], M + labelW, y);
      y += 4;
    }
  };

  // === COVER HEADER ===
  drawPageHeader(doc, setFill);
  y = M + 4;

  setColor(PLACEHOLDER_GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('ERC CV & TRACK RECORD', M, y);
  y += 6;

  setColor(DARK);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.name, M, y);
  y += 7;

  if (data.affiliation) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    doc.text(data.affiliation, M, y);
    y += 5;
  }

  const stats = [
    `h-index: ${data.hIndex}`,
    `Citations: ${data.totalCitations.toLocaleString()}`,
    `Publications: ${data.publications.length}`,
  ];
  doc.setFontSize(8);
  setColor(TEAL);
  doc.text(stats.join('   |   '), M, y);
  y += 8;

  doc.setDrawColor(LIGHT_GRAY[0], LIGHT_GRAY[1], LIGHT_GRAY[2]);
  doc.setLineWidth(0.3);
  doc.line(M, y, PAGE_W - M, y);
  y += 8;

  // ERC guidance note
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  setColor(PLACEHOLDER_GRAY);
  const ercNote = 'ERC CV & Track Record: target 4 pages. Complete placeholder sections before submission. ' +
    'Do not include journal impact factors per ERC guidelines.';
  const noteLines = doc.splitTextToSize(ercNote, CW);
  doc.text(noteLines, M, y);
  y += noteLines.length * 3.5 + 6;

  // ==============================
  // SECTION A: PERSONAL INFORMATION
  // ==============================
  sectionTitle('A. Personal Information');

  labelValue('Name', data.name);
  if (data.affiliation) labelValue('Current affiliation', data.affiliation);

  if (data.topics.length > 0) {
    const topicNames = data.topics.map(t =>
      typeof t.name === 'object' ? (t.name as { title?: string }).title || '' : String(t.name)
    ).filter(Boolean);
    labelValue('Research areas', topicNames.slice(0, 5).join(', '));
  }

  placeholderText('[Add: ORCID iD, nationality, date of birth (if required by call)]');
  y += 3;

  // ==============================
  // SECTION B: EDUCATION & KEY QUALIFICATIONS
  // ==============================
  sectionTitle('B. Education & Key Qualifications');

  if (orcid?.educations && orcid.educations.length > 0) {
    for (const ed of orcid.educations) {
      ensureSpace(10);
      const dateRange = orcidDateRange(ed.startYear, ed.endYear);
      const degreeLabel = [ed.degree, ed.department].filter(Boolean).join(' in ');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setColor(DARK);
      doc.text(degreeLabel || '(Degree not specified)', M, y);
      if (dateRange) {
        doc.setFont('helvetica', 'normal');
        setColor(GRAY);
        doc.text(dateRange, PAGE_W - M, y, { align: 'right' });
      }
      y += 4;
      const locationParts = [ed.city, ed.country].filter(Boolean).join(', ');
      const institutionLine = [ed.institution, locationParts].filter(Boolean).join(', ');
      bodyText(institutionLine, 0);
      y += 1;
    }
    placeholderText('[Add: thesis title or additional qualifications if relevant]');
  } else {
    placeholderText('[PhD degree, institution, year, thesis title]');
    placeholderText('[MSc / MA degree, institution, year]');
    placeholderText('[BSc / BA degree, institution, year]');
    placeholderText('[Any additional qualifications, certifications, or relevant training]');
  }
  y += 3;

  // ==============================
  // SECTION C: CURRENT AND PREVIOUS POSITIONS
  // ==============================
  sectionTitle('C. Current and Previous Positions');

  if (orcid?.employments && orcid.employments.length > 0) {
    for (const em of orcid.employments) {
      ensureSpace(10);
      const dateRange = orcidDateRange(em.startYear, em.endYear);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setColor(DARK);
      doc.text(em.role || '(Role not specified)', M, y);
      if (dateRange) {
        doc.setFont('helvetica', 'normal');
        setColor(GRAY);
        doc.text(dateRange, PAGE_W - M, y, { align: 'right' });
      }
      y += 4;
      const locationParts = [em.city, em.country].filter(Boolean).join(', ');
      const instLine = [em.institution, locationParts].filter(Boolean).join(', ');
      bodyText(instLine, 0);
      y += 1;
    }
    placeholderText('[Add: visiting appointments or industry roles if relevant]');
  } else {
    if (data.affiliation) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      setColor(DARK);
      doc.text(`Current: ${data.affiliation}`, M, y);
      y += 5;
    }
    placeholderText('[Add: previous positions with institution name, role, and dates (YYYY–YYYY)]');
    placeholderText('[Include postdoctoral positions, visiting appointments, and industry roles if relevant]');
  }
  y += 3;

  // ==============================
  // SECTION D: RESEARCH ACHIEVEMENTS & PEER RECOGNITION
  // ==============================
  sectionTitle('D. Research Achievements & Peer Recognition');

  const narrativeParagraphs = generateNarrativeParagraphs(data);

  subHeading('Career summary');
  if (narrativeParagraphs[0]) {
    bodyText(stripMarkdown(narrativeParagraphs[0]));
    y += 2;
  }

  const impactPara = narrativeParagraphs.find(p =>
    p.includes('h-index') || p.includes('citations') || p.includes('most cited')
  );
  if (impactPara) {
    bodyText(stripMarkdown(impactPara));
    y += 2;
  }

  const trendPara = narrativeParagraphs.find(p =>
    p.includes('publication output') || p.includes('publication pace') || p.includes('publication rate')
  );
  if (trendPara) {
    bodyText(stripMarkdown(trendPara));
    y += 3;
  }

  subHeading('Grants & funding');
  if (orcid?.fundings && orcid.fundings.length > 0) {
    for (const fu of orcid.fundings) {
      ensureSpace(10);
      const dateRange = orcidDateRange(fu.startYear, fu.endYear);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setColor(DARK);
      const titleLines = doc.splitTextToSize(fu.title || '(Untitled grant)', CW - 30);
      doc.text(titleLines[0], M, y);
      if (dateRange) {
        doc.setFont('helvetica', 'normal');
        setColor(GRAY);
        doc.text(dateRange, PAGE_W - M, y, { align: 'right' });
      }
      y += 4;
      for (let i = 1; i < titleLines.length; i++) {
        ensureSpace(4);
        doc.setFont('helvetica', 'bold');
        setColor(DARK);
        doc.text(titleLines[i], M, y);
        y += 4;
      }
      bodyText(fu.funder, 0);
      y += 1;
    }
    placeholderText('[Add: funding amounts where relevant]');
  } else {
    placeholderText('[List research grants received, funding body, amount, and period (e.g. NWO Veni, ERC StG)]');
  }

  subHeading('Awards & prizes');
  if (orcid?.distinctions && orcid.distinctions.length > 0) {
    for (const dist of orcid.distinctions) {
      const yearStr = dist.year ? ` (${dist.year})` : '';
      bodyText(`${dist.title} — ${dist.organization}${yearStr}`);
    }
    y += 1;
  } else {
    placeholderText('[List academic awards, best paper prizes, teaching awards, etc.]');
  }

  subHeading('Editorial & professional roles');
  placeholderText('[List editorial board memberships, conference programme committee roles, society memberships]');

  subHeading('Invited talks');
  placeholderText('[List keynotes, invited seminar talks, and conference presentations (last 5 years)]');

  subHeading('Media & societal impact');
  placeholderText('[Describe any policy impact, media coverage, consultancy, or knowledge transfer activities]');

  y += 3;

  // ==============================
  // SECTION E: SELECTED PUBLICATIONS & OUTPUTS
  // ==============================
  sectionTitle('E. Selected Publications & Outputs (max. 10)');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  setColor(GRAY);
  const pubNote = 'Ranked by journal prestige (FT50, then ABS) and citation count. ' +
    'Note: journal impact factors are not included per ERC guidelines.';
  const pubNoteLines = doc.splitTextToSize(pubNote, CW);
  doc.text(pubNoteLines, M, y);
  y += pubNoteLines.length * 3.5 + 4;

  const keyOutputs = selectKeyOutputs(data.publications);
  const hasOaData = !!data.openAccess?.publicationOa;

  if (hasOaData) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    setColor(TEAL);
    doc.text('[OA] = Open Access', M, y);
    y += 4;
  }

  for (let i = 0; i < keyOutputs.length; i++) {
    const pub = keyOutputs[i];
    ensureSpace(18);

    const oaFlag = hasOaData && isOA(pub, data.openAccess) ? ' [OA]' : '';

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    const titleText = `${i + 1}. ${pub.title}${oaFlag}`;
    const titleLines = doc.splitTextToSize(titleText, CW);
    for (const line of titleLines) {
      ensureSpace(4);
      doc.text(line, M, y);
      y += 4;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    const authorsText = pub.authors.slice(0, 6).join(', ') + (pub.authors.length > 6 ? ' et al.' : '');
    const aLines = doc.splitTextToSize(authorsText, CW);
    for (const line of aLines) {
      ensureSpace(4);
      doc.text(line, M + 4, y);
      y += 3.5;
    }

    const venue = pub.venue ? pub.venue.replace(/,.*$/, '').trim() : '';
    const rankingParts: string[] = [];
    if (pub.journalRanking?.ft50) rankingParts.push('FT50');
    if (pub.journalRanking?.abs) rankingParts.push(`ABS ${pub.journalRanking.abs}`);
    if (pub.journalRanking?.abdc) rankingParts.push(`ABDC ${pub.journalRanking.abdc}`);
    if (pub.journalRanking?.sjr) rankingParts.push(`SJR ${pub.journalRanking.sjr}`);

    const metaParts = [
      venue,
      pub.year ? String(pub.year) : '',
      pub.citations > 0 ? `${pub.citations} citation${pub.citations !== 1 ? 's' : ''}` : '',
    ].filter(Boolean);
    const metaLine = metaParts.join('  ·  ');

    doc.setFontSize(7.5);
    setColor(GRAY);
    doc.text(metaLine, M + 4, y);

    if (rankingParts.length > 0) {
      const metaW = doc.getTextWidth(metaLine);
      setColor(TEAL);
      doc.text('  ' + rankingParts.join(' · '), M + 4 + metaW, y);
    }

    y += 6;
  }

  // ==============================
  // SECTION F: NARRATIVE ON TRACK RECORD
  // ==============================
  sectionTitle('F. Narrative on Track Record');

  subHeading('Research evolution');
  const evolutionPara = narrativeParagraphs.find(p =>
    p.includes('earlier work') || p.includes('shifted towards') || p.includes('consistently centered')
  );
  if (evolutionPara) {
    bodyText(stripMarkdown(evolutionPara));
    y += 2;
  } else {
    placeholderText('[Describe how your research has evolved over your career and where it is headed.]');
  }

  subHeading('Research methods & approach');
  const methodsPara = narrativeParagraphs.find(p =>
    p.includes('draws on') || p.includes('methods')
  );
  if (methodsPara && methodsPara !== narrativeParagraphs[0]) {
    bodyText(stripMarkdown(methodsPara));
    y += 2;
  } else {
    placeholderText('[Describe the methods and approaches that characterise your research.]');
  }

  subHeading('Research themes');
  if (data.topics.length > 0) {
    const topicNames = data.topics.map(t =>
      typeof t.name === 'object' ? (t.name as { title?: string }).title || '' : String(t.name)
    ).filter(Boolean);
    bodyText('Core research themes: ' + topicNames.slice(0, 6).join(', ') + '.');
    y += 2;
  }
  placeholderText('[Expand on the central themes of your research programme and their scientific significance.]');
  placeholderText('[Explain how these themes connect to broader challenges in your field and to the proposed project.]');

  subHeading('Collaboration & international profile');
  const collabPara = narrativeParagraphs.find(p =>
    p.includes('co-authored') || p.includes('collaborator') || p.includes('single-authored')
  );
  if (collabPara) {
    bodyText(stripMarkdown(collabPara));
    y += 2;
  }
  placeholderText('[Add information about international collaborations, research networks, and mobility.]');

  // Page count note
  ensureSpace(10);
  y += 3;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  setColor(PLACEHOLDER_GRAY);
  doc.text(
    `This document currently spans ${doc.getNumberOfPages()} page(s). ERC CV target is 4 pages — trim placeholder sections before submission.`,
    M, y
  );

  addFooter(doc, 'ERC CV & Track Record');
  const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`ScholarFolio_ERC_CV_${safeName}_${dateStr}.pdf`);
}

// ============================================================
// Shared helpers
// ============================================================

function drawPageHeader(
  doc: jsPDF,
  setFill: (c: readonly [number, number, number]) => void
): void {
  setFill(TEAL);
  doc.rect(0, 0, PAGE_W, 3, 'F');
}

function addFooter(doc: jsPDF, label: string): void {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom accent bar
    doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.rect(0, PAGE_H - 3, PAGE_W, 3, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated by ScholarFolio · scholarfolio.org · ${label} · ${dateStr}`, M, PAGE_H - 6);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
  }
}
