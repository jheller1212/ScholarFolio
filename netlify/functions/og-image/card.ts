// 1200×630 share card as SVG; og-image.ts rasterizes it to PNG because
// LinkedIn/X/Facebook don't accept SVG previews. Pure string work so it can
// be unit-tested without the wasm renderer.

export interface CardInput {
  name: string;
  affiliation?: string;
  totalCitations?: number;
  hIndex?: number;
  i10Index?: number;
  // Shown bottom-right, e.g. "scholarfolio.org/jonas-heller".
  urlLabel: string;
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const SERIF = 'Playfair Display';
const SANS = 'DM Sans';
const TEXT_LEFT = 88;
const TEXT_WIDTH = CARD_WIDTH - TEXT_LEFT * 2;

// resvg can't measure text for us, so wrap on an average glyph width (em
// fraction). Slightly generous so lines never overflow the card edge.
const AVG_CHAR_EM = { serif: 0.56, sans: 0.5 } as const;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let i = 0;
  for (; i < words.length; i++) {
    const word = words[i].length > maxChars ? `${words[i].slice(0, maxChars - 1)}…` : words[i];
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    lines.push(current);
    if (lines.length === maxLines) {
      current = '';
      break;
    }
    current = word;
  }
  if (current) lines.push(current);
  if (i < words.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.length >= maxChars ? last.slice(0, maxChars - 1).trimEnd() : last}…`;
  }
  return lines;
}

function charsThatFit(fontSize: number, kind: keyof typeof AVG_CHAR_EM): number {
  return Math.floor(TEXT_WIDTH / (fontSize * AVG_CHAR_EM[kind]));
}

// Biggest name size that fits on at most two lines.
function fitName(name: string): { size: number; lines: string[] } {
  for (const size of [76, 68, 60, 54, 48]) {
    const lines = wrapText(name, charsThatFit(size, 'serif'), 2);
    if (lines.join(' ') === name.trim().split(/\s+/).join(' ')) return { size, lines };
  }
  return { size: 48, lines: wrapText(name, charsThatFit(48, 'serif'), 2) };
}

export function formatMetric(n: number): string {
  return n.toLocaleString('en-US');
}

export function buildCardSvg(input: CardInput): string {
  const { size: nameSize, lines: nameLines } = fitName(input.name);
  const affLines = input.affiliation ? wrapText(input.affiliation, charsThatFit(30, 'sans'), 2) : [];

  const nameTop = 210;
  const nameSvg = nameLines
    .map((line, i) => `<text x="${TEXT_LEFT}" y="${nameTop + i * nameSize * 1.12}" font-family="${SERIF}" font-weight="700" font-size="${nameSize}" fill="#ffffff">${esc(line)}</text>`)
    .join('\n  ');
  const affTop = nameTop + (nameLines.length - 1) * nameSize * 1.12 + 56;
  const affSvg = affLines
    .map((line, i) => `<text x="${TEXT_LEFT}" y="${affTop + i * 40}" font-family="${SANS}" font-weight="400" font-size="30" fill="#cbd5e1">${esc(line)}</text>`)
    .join('\n  ');

  const metrics: Array<[string, number | undefined]> = [
    ['Citations', input.totalCitations],
    ['h-index', input.hIndex],
    ['i10-index', input.i10Index],
  ];
  const shown = metrics.filter((m): m is [string, number] => typeof m[1] === 'number' && Number.isFinite(m[1]));
  const metricsSvg = shown
    .map(([label, value], i) => {
      const x = TEXT_LEFT + i * 300;
      return `<text x="${x}" y="508" font-family="${SANS}" font-weight="700" font-size="60" fill="#ffffff">${esc(formatMetric(value))}</text>
  <text x="${x}" y="548" font-family="${SANS}" font-weight="400" font-size="24" fill="#94a3b8">${esc(label)}</text>`;
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
  <rect width="12" height="${CARD_HEIGHT}" fill="#2d7d7d"/>
  <g transform="translate(${TEXT_LEFT - 6}, 52) scale(2)">
    <path d="M5 10C5 8 7 7 9 7C11 7 13 8 15 9C17 8 19 7 21 7C23 7 25 8 25 10V23C25 24 24 25 22 25C20 25 18 24 15 23C12 24 10 25 8 25C6 25 5 24 5 23V10Z" stroke="#5eb5b5" stroke-width="1.8" fill="none"/>
    <line x1="15" y1="9" x2="15" y2="23" stroke="#5eb5b5" stroke-width="1.5"/>
    <path d="M17 16L20 12L23 8" stroke="#5eb5b5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="23" cy="8" r="1.5" fill="#5eb5b5"/>
  </g>
  <text x="${TEXT_LEFT + 62}" y="102" font-family="${SERIF}" font-weight="700" font-size="36"><tspan fill="#ffffff">Scholar</tspan><tspan fill="#5eb5b5">Folio</tspan></text>
  ${nameSvg}
  ${affSvg}
  ${metricsSvg}
  <text x="${CARD_WIDTH - TEXT_LEFT}" y="${CARD_HEIGHT - 40}" text-anchor="end" font-family="${SANS}" font-weight="400" font-size="22" fill="#94a3b8">${esc(input.urlLabel)}</text>
</svg>`;
}
