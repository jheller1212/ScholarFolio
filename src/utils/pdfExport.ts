import jsPDF from 'jspdf';
import type { Author, CoAuthorGeoData } from '../types/scholar';
import { extractLastName } from './names';
import { generateNarrativeParagraphs, generateFieldMetricsParagraphText, generateGeoParagraphText, generateCitationDistributionParagraphText, generateOpenAccessParagraphText } from '../components/ResearcherNarrative';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 15; // margin
const CW = PAGE_W - M * 2; // content width
const TEAL = [45, 125, 125] as const; // #2d7d7d
const DARK = [30, 41, 59] as const; // #1e293b
const GRAY = [100, 116, 139] as const; // #64748b
const LIGHT_GRAY = [203, 213, 225] as const;

export function exportProfilePdf(data: Author, scholarId?: string, geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;

  // --- Helpers ---
  const setColor = (c: readonly [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: readonly [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - 15) {
      doc.addPage();
      y = M;
    }
  };

  const drawDivider = () => {
    doc.setDrawColor(LIGHT_GRAY[0], LIGHT_GRAY[1], LIGHT_GRAY[2]);
    doc.line(M, y, PAGE_W - M, y);
    y += 6;
  };

  const sectionTitle = (text: string) => {
    ensureSpace(12);
    setColor(TEAL);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(text, M, y);
    y += 7;
    setColor(DARK);
  };

  // Metric card grid — mimics the website's card layout
  const CARD_W = (CW - 8) / 3; // 3 columns with gaps
  const CARD_H = 18;
  const CARD_GAP = 4;
  const CARD_BG = [248, 250, 252] as const; // #f8fafc
  const CARD_BORDER = [226, 232, 240] as const; // #e2e8f0

  let cardCol = 0;
  let cardRowY = 0;

  const startCardGrid = () => {
    cardCol = 0;
    cardRowY = y;
  };

  const metricCard = (label: string, value: string, subtitle?: string) => {
    if (cardCol >= 3) {
      cardCol = 0;
      cardRowY += CARD_H + CARD_GAP;
    }
    if (cardCol === 0) {
      ensureSpace(CARD_H + CARD_GAP + 2);
      if (cardRowY < y) cardRowY = y;
    }

    const cx = M + cardCol * (CARD_W + CARD_GAP);
    const cy = cardRowY;

    // Card background
    setFill(CARD_BG);
    doc.setDrawColor(CARD_BORDER[0], CARD_BORDER[1], CARD_BORDER[2]);
    doc.roundedRect(cx, cy, CARD_W, CARD_H, 1.5, 1.5, 'FD');

    // Value (large, bold, teal)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    setColor(TEAL);
    doc.text(String(value), cx + 3, cy + 7);

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setColor(DARK);
    doc.text(label, cx + 3, cy + 12);

    // Subtitle
    if (subtitle) {
      doc.setFontSize(5.5);
      setColor(GRAY);
      doc.text(subtitle, cx + 3, cy + 15.5);
    }

    cardCol++;
    y = cardRowY + CARD_H + CARD_GAP;
  };

  // === HEADER ===
  // Teal accent bar
  setFill(TEAL);
  doc.rect(0, 0, PAGE_W, 3, 'F');

  y = 12;

  // Name
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  setColor(DARK);
  doc.text(data.name, M, y);
  y += 8;

  // Affiliation
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  setColor(GRAY);
  doc.text(data.affiliation || '', M, y);
  y += 6;

  // Link to profile on ScholarFolio
  if (scholarId) {
    const profileUrl = `https://scholarfolio.org/?user=${encodeURIComponent(scholarId)}`;
    setFill([234, 244, 244]); // #eaf4f4
    const linkText = 'View live profile on ScholarFolio';
    doc.setFontSize(8);
    const linkW = doc.getTextWidth(linkText) + 8;
    doc.roundedRect(M, y - 3, linkW, 5.5, 1.5, 1.5, 'F');
    setColor(TEAL);
    doc.textWithLink(linkText, M + 4, y, { url: profileUrl });
    y += 6;
  }

  // Key stats boxes
  const stats = [
    { label: 'Citations', value: data.totalCitations.toLocaleString() },
    { label: 'h-index', value: String(data.hIndex) },
    { label: 'Publications', value: String(data.publications.length) },
  ];
  const boxW = 35;
  const boxH = 16;
  const boxGap = 5;
  const boxStartX = M;
  stats.forEach((s, i) => {
    const bx = boxStartX + i * (boxW + boxGap);
    setFill([234, 244, 244]); // #eaf4f4
    doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    setColor(TEAL);
    doc.text(s.value, bx + boxW / 2, y + 7, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    doc.text(s.label, bx + boxW / 2, y + 12, { align: 'center' });
  });
  y += boxH + 6;

  // Topics
  if (data.topics.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setColor(TEAL);
    const topicNames = data.topics.map(t =>
      typeof t.name === 'object' ? (t.name as any).title : t.name
    ).filter(Boolean);
    const topicLine = topicNames.join('  ·  ');
    const topicLines = doc.splitTextToSize(topicLine, CW);
    doc.text(topicLines, M, y);
    y += topicLines.length * 3.5 + 4;
  }

  // === RESEARCH PROFILE NARRATIVE ===
  const narrativeParagraphs = generateNarrativeParagraphs(data);
  const fieldMetricsPara = generateFieldMetricsParagraphText(data.fieldMetrics);
  const citDistPara = generateCitationDistributionParagraphText(data.metrics, data.totalCitations);
  const geoPara = generateGeoParagraphText(geoData);
  const oaPara = generateOpenAccessParagraphText(data);
  const allNarrativeParagraphs = [
    ...narrativeParagraphs,
    fieldMetricsPara,
    citDistPara,
    geoPara,
    oaPara,
  ].filter(Boolean) as string[];

  if (allNarrativeParagraphs.length > 0) {
    sectionTitle('Research Profile');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    setColor(DARK);
    for (const para of allNarrativeParagraphs) {
      ensureSpace(12);
      const plainPara = para.replace(/\*\*(.*?)\*\*/g, '$1');
      const lines = doc.splitTextToSize(plainPara, CW);
      doc.text(lines, M, y);
      y += lines.length * 3.5 + 2;
    }
    y += 2;
  }

  drawDivider();

  // === IMPACT METRICS ===
  sectionTitle('Impact Metrics');

  const m = data.metrics;
  startCardGrid();
  metricCard('Total Citations', data.totalCitations.toLocaleString());
  metricCard('h-index', String(m.hIndex));
  metricCard('g-index', String(m.gIndex));
  metricCard('i10-index', String(m.i10Index), `${m.i10Index} papers with 10+ cites`);
  metricCard('h5-index', String(m.h5Index), 'Last 5 years');
  metricCard('Publications', String(m.totalPublications));
  metricCard('Pubs Per Year', String(m.publicationsPerYear));
  metricCard('Citations/Paper', String(m.avgCitationsPerPaper));
  metricCard('Citations/Year', String(m.avgCitationsPerYear));
  metricCard('Citation Growth', `${m.citationGrowthRate > 0 ? '+' : ''}${m.citationGrowthRate}%`, '3-yr avg. growth rate');
  metricCard('Citation Half-Life', `${m.citationHalfLife} yr${m.citationHalfLife !== 1 ? 's' : ''}`, 'Years to 50% of citations');
  metricCard('Citation Gini', String(m.citationGini), m.citationGini >= 0.7 ? 'Concentrated' : m.citationGini >= 0.4 ? 'Moderate' : 'Spread evenly');
  metricCard('Citations/Career Yr', String(m.ageNormalizedRate), 'Age-normalized rate');

  // === PAGE 2: COLLABORATION ===
  doc.addPage();
  y = M;
  setFill(TEAL);
  doc.rect(0, 0, PAGE_W, 3, 'F');
  y = 12;

  sectionTitle('Collaboration Metrics');

  startCardGrid();
  metricCard('Co-authors', String(m.totalCoAuthors));
  metricCard('Avg Authors/Paper', String(m.averageAuthors));
  metricCard('Solo Author Rate', `${m.soloAuthorScore}%`);
  metricCard('Collaboration Rate', `${m.collaborationScore}%`);
  if (m.topCoAuthor) {
    metricCard('Top Co-author', extractLastName(m.topCoAuthor), `${m.topCoAuthorPapers} papers`);
  }

  // === PAGE 3: CITATION TRENDS ===
  doc.addPage();
  y = M;

  // Accent bar
  setFill(TEAL);
  doc.rect(0, 0, PAGE_W, 3, 'F');
  y = 12;

  sectionTitle('Citation Trends');

  const citYears = Object.entries(m.citationsPerYear)
    .map(([yr, count]) => ({ year: Number(yr), count: count as number }))
    .sort((a, b) => a.year - b.year);

  if (citYears.length > 0) {
    // Draw bar chart
    const chartX = M;
    const chartW = CW;
    const chartH = 50;
    const maxCount = Math.max(...citYears.map(c => c.count), 1);
    const barW = Math.min((chartW - 10) / citYears.length - 1, 12);
    const gap = (chartW - barW * citYears.length) / (citYears.length + 1);

    // Y-axis labels
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxCount / 4) * i);
      const ly = y + chartH - (i / 4) * chartH;
      doc.text(String(val), chartX - 1, ly + 1, { align: 'right' });
      doc.setDrawColor(240, 240, 240);
      doc.line(chartX + 2, ly, chartX + chartW, ly);
    }

    // Bars
    citYears.forEach((c, i) => {
      const bx = chartX + gap + i * (barW + gap);
      const bh = (c.count / maxCount) * chartH;
      const by = y + chartH - bh;

      setFill(TEAL);
      doc.roundedRect(bx, by, barW, bh, 1, 1, 'F');

      // Year label
      doc.setFontSize(5);
      setColor(GRAY);
      doc.text(String(c.year), bx + barW / 2, y + chartH + 4, { align: 'center' });

      // Count on top of bar
      if (bh > 4) {
        doc.setFontSize(5);
        setColor(DARK);
        doc.text(String(c.count), bx + barW / 2, by - 1.5, { align: 'center' });
      }
    });

    y += chartH + 10;

    // Table of citation data
    y += 4;
    sectionTitle('Citations by Year');

    // Table header
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    doc.text('Year', M + 2, y);
    doc.text('Citations', M + 25, y);
    doc.text('Cumulative', M + 50, y);
    y += 2;
    doc.setDrawColor(LIGHT_GRAY[0], LIGHT_GRAY[1], LIGHT_GRAY[2]);
    doc.line(M, y, M + 75, y);
    y += 3;

    let cumulative = 0;
    doc.setFontSize(8);
    for (const c of citYears) {
      ensureSpace(5);
      cumulative += c.count;
      doc.setFont('helvetica', 'normal');
      setColor(GRAY);
      doc.text(String(c.year), M + 2, y);
      doc.setFont('helvetica', 'bold');
      setColor(DARK);
      doc.text(String(c.count), M + 25, y);
      doc.setFont('helvetica', 'normal');
      setColor(GRAY);
      doc.text(cumulative.toLocaleString(), M + 50, y);
      y += 4.5;
    }
  } else {
    doc.setFontSize(9);
    setColor(GRAY);
    doc.text('No citation trend data available.', M, y);
    y += 6;
  }

  // === PAGE 3+: ALL PUBLICATIONS ===
  doc.addPage();
  y = M;

  setFill(TEAL);
  doc.rect(0, 0, PAGE_W, 3, 'F');
  y = 12;

  sectionTitle(`All Publications (${data.publications.length})`);

  const allPubs = [...data.publications].sort((a, b) => b.year - a.year || b.citations - a.citations);

  doc.setFontSize(8);
  for (let i = 0; i < allPubs.length; i++) {
    const pub = allPubs[i];
    ensureSpace(14);

    // Title
    setColor(DARK);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(pub.title, CW - 8);
    doc.text(titleLines, M + 6, y);
    y += titleLines.length * 3.2;

    // Authors
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    doc.setFontSize(7);
    const authorsText = pub.authors.slice(0, 5).join(', ') + (pub.authors.length > 5 ? ', ...' : '');
    const authorLines = doc.splitTextToSize(authorsText, CW - 8);
    doc.text(authorLines, M + 6, y);
    y += authorLines.length * 3;

    // Venue, year, citations
    const venue = pub.venue ? pub.venue.replace(/,.*$/, '').trim() : '';
    const meta = [venue, pub.year ? String(pub.year) : '', `${pub.citations} citation${pub.citations !== 1 ? 's' : ''}`].filter(Boolean).join('  ·  ');
    doc.text(meta, M + 6, y);
    y += 5;

    doc.setFontSize(8);
  }

  // === FOOTER on every page ===
  const now = new Date();
  const timestamp = now.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom accent bar
    setFill(TEAL);
    doc.rect(0, PAGE_H - 3, PAGE_W, 3, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    const footerText = `Data sourced from Google Scholar on ${timestamp}.`;
    doc.text(footerText, M, PAGE_H - 6);

    // Clickable ScholarFolio link
    const linkX = M + doc.getTextWidth(footerText) + 2;
    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.setFont('helvetica', 'bold');
    doc.textWithLink('Generated by ScholarFolio — scholarfolio.org', linkX, PAGE_H - 6, { url: 'https://scholarfolio.org' });
    doc.setFont('helvetica', 'normal');

    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
  }

  const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`ScholarFolio_${safeName}_${now.toISOString().slice(0, 10)}.pdf`);
}
