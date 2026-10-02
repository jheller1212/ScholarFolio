// Cuts the narrative down to its opening sentences for the collapsed view.
// Written as a scanner rather than a lookbehind regex: iOS < 16.4 (still common
// inside LinkedIn/Facebook in-app browsers) throws on lookbehind at parse time,
// which would take down the whole profile bundle.

const ABBREVIATIONS = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'st', 'vs', 'al', 'etc', 'jr', 'sr', 'no', 'vol', 'eg', 'ie', 'inc', 'ltd', 'co', 'univ', 'dept']);

const CLOSERS = new Set(['*', '"', '”', ')']);

function skipClosers(text: string, from: number): number {
  let j = from;
  while (j < text.length && CLOSERS.has(text[j])) j++;
  return j;
}

function isSentenceEnd(text: string, i: number): boolean {
  const ch = text[i];
  if (ch !== '.' && ch !== '!' && ch !== '?') return false;

  // Skip closing markup/quotes so `**2019**.` and `."` still end a sentence.
  let j = skipClosers(text, i + 1);
  if (j >= text.length) return true;
  if (!/\s/.test(text[j])) return false;
  while (j < text.length && /\s/.test(text[j])) j++;
  if (j >= text.length) return true;
  // The next sentence starts with an uppercase letter, number, quote or bold marker.
  if (!/[A-Z0-9"“*]/.test(text[j])) return false;

  if (ch === '.') {
    // Initials ("J.") and common abbreviations ("Prof.", "et al.") are not sentence ends.
    let k = i - 1;
    while (k >= 0 && /[A-Za-z.]/.test(text[k])) k--;
    const word = text.slice(k + 1, i).replace(/\./g, '').toLowerCase();
    if (word.length === 1) return false;
    if (ABBREVIATIONS.has(word)) return false;
  }
  return true;
}

/** Split text into sentences, keeping the terminating punctuation. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!isSentenceEnd(text, i)) continue;
    const end = skipClosers(text, i + 1);
    const sentence = text.slice(start, end).trim();
    if (sentence) out.push(sentence);
    start = end;
    i = end - 1;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/**
 * First `count` sentences of the first paragraph, plus whether anything was cut
 * (more sentences in that paragraph, or more paragraphs after it).
 */
export function leadSentences(paragraphs: string[], count: number): { lead: string; truncated: boolean } {
  if (paragraphs.length === 0) return { lead: '', truncated: false };
  const sentences = splitSentences(paragraphs[0]);
  const lead = sentences.slice(0, count).join(' ');
  return { lead, truncated: sentences.length > count || paragraphs.length > 1 };
}
