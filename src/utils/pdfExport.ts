import jsPDF from 'jspdf';
import type { Author } from '../types/scholar';
import { extractLastName } from './names';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 15; // margin
const CW = PAGE_W - M * 2; // content width
const TEAL = [45, 125, 125] as const; // #2d7d7d
const DARK = [30, 41, 59] as const; // #1e293b
const GRAY = [100, 116, 139] as const; // #64748b
const LIGHT_GRAY = [203, 213, 225] as const;

export function exportProfilePdf(data: Author) {
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

  const metricRow = (label: string, value: string, subtitle?: string) => {
    ensureSpace(6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY);
    doc.text(label, M + 2, y);
    doc.setFont('helvetica', 'bold');
    setColor(DARK);
    doc.text(String(value), M + 65, y);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      setColor(GRAY);
      doc.setFontSize(7.5);
      doc.text(subtitle, M + 65 + doc.getTextWidth(String(value)) + 3, y);
    }
    y += 5;
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
  y += 8;

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

  drawDivider();

  // === IMPACT METRICS ===
  sectionTitle('Impact Metrics');

  const m = data.metrics;
  metricRow('Total Citations', data.totalCitations.toLocaleString());
  metricRow('h-index', String(m.hIndex));
  metricRow('g-index', String(m.gIndex));
  metricRow('i10-index', String(m.i10Index), `${m.i10Index} papers with 10+ citations`);
  metricRow('h5-index', String(m.h5Index), 'Last 5 years');
  metricRow('Publications', String(m.totalPublications));
  metricRow('Pubs Per Year', String(m.publicationsPerYear));
  metricRow('Citations/Paper', String(m.avgCitationsPerPaper));
  metricRow('Citations/Year', String(m.avgCitationsPerYear));
  metricRow('Citation Growth', `${m.citationGrowthRate > 0 ? '+' : ''}${m.citationGrowthRate}%`, '3-year avg. growth rate');
  metricRow('Citation Half-Life', `${m.citationHalfLife} yr${m.citationHalfLife !== 1 ? 's' : ''}`, 'Years to 50% of citations');
  metricRow('Citation Gini', String(m.citationGini), m.citationGini >= 0.7 ? 'Concentrated' : m.citationGini >= 0.4 ? 'Moderate' : 'Spread evenly');
  metricRow('Citations/Career Yr', String(m.ageNormalizedRate), 'Age-normalized rate');

  y += 4;
  drawDivider();

  // === COLLABORATION ===
  sectionTitle('Collaboration Metrics');

  metricRow('Co-authors', String(m.totalCoAuthors));
  metricRow('Avg Authors/Paper', String(m.averageAuthors));
  metricRow('Solo Author Rate', `${m.soloAuthorScore}%`);
  metricRow('Collaboration Rate', `${m.collaborationScore}%`);
  if (m.topCoAuthor) {
    metricRow('Top Co-author', extractLastName(m.topCoAuthor), `${m.topCoAuthorPapers} papers`);
  }

  y += 4;
  drawDivider();

  // === PAGE 2: CITATION TRENDS ===
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
    doc.text(
      `Data sourced from Google Scholar on ${timestamp}. ScholarFolio — scholarfolio.org`,
      M,
      PAGE_H - 6,
    );
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
  }

  const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`ScholarFolio_${safeName}_${now.toISOString().slice(0, 10)}.pdf`);
}
