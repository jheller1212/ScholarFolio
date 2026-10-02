/**
 * Pure logic for the monthly citation digest: parsing Google Scholar headline
 * numbers and diffing two monthly snapshots. Dependency-free so the vitest
 * suite in src/ can exercise it directly.
 *
 * Google Scholar is the headline source (citations, h-index, i10), so the
 * digest diffs GS numbers, not OpenAlex ones. Both snapshots must come from the
 * same source: GS's official total and a sum over a cached publication list
 * differ slightly, and that difference would show up as a fake "change".
 */

export interface GsWork {
  /** Normalised title — stable across sources, unlike per-source ids. */
  key: string;
  title: string;
  citations: number;
}

export interface GsSnapshot {
  citations: number | null;
  hIndex: number | null;
  i10Index: number | null;
  topWorks: GsWork[];
}

export interface StoredSnapshot {
  captured_month: string;
  gs_citations: number | null;
  gs_h_index: number | null;
  gs_i10_index: number | null;
  gs_top_works: GsWork[] | null;
  gs_source: string | null;
}

export interface DigestDiff {
  citationsDelta: number;
  citationsTotal: number;
  hIndexBefore: number | null;
  hIndexAfter: number | null;
  topPaper: { title: string; gained: number } | null;
}

/** How many most-cited works a snapshot keeps for the per-paper diff. */
export const TOP_WORKS_KEPT = 100;

export function titleKey(title: string): string {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toInt(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^\d]/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

function topWorks(items: Array<{ title: string; citations: number }>): GsWork[] {
  return items
    .filter(w => w.title && w.citations >= 0)
    .sort((a, b) => b.citations - a.citations)
    .slice(0, TOP_WORKS_KEPT)
    .map(w => ({ key: titleKey(w.title), title: w.title, citations: w.citations }));
}

/** Parse a SerpAPI `google_scholar_author` response (first page, default
 *  citation order) into headline numbers + most-cited works. */
export function parseSerpAuthor(json: unknown): GsSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const j = json as {
    cited_by?: { table?: Array<Record<string, { all?: unknown }>> };
    articles?: Array<{ title?: string; cited_by?: { value?: unknown } }>;
  };
  const table = j.cited_by?.table ?? [];
  const pick = (k: string) => toInt(table.find(row => k in row)?.[k]?.all);
  const citations = pick("citations");
  if (citations === null) return null;
  const works = (j.articles ?? []).map(a => ({ title: a.title ?? "", citations: toInt(a.cited_by?.value) ?? 0 }));
  return { citations, hIndex: pick("h_index"), i10Index: pick("i10_index"), topWorks: topWorks(works) };
}

/** Parse a scholar_cache profile payload (written by the scholar function). */
export function parseCachedProfile(data: unknown): GsSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const d = data as {
    totalCitations?: unknown; hIndex?: unknown;
    metrics?: { hIndex?: unknown; i10Index?: unknown };
    publications?: Array<{ title?: string; citations?: unknown }>;
  };
  const citations = toInt(d.totalCitations);
  if (citations === null) return null;
  const works = (d.publications ?? []).map(p => ({ title: p.title ?? "", citations: toInt(p.citations) ?? 0 }));
  return {
    citations,
    hIndex: toInt(d.metrics?.hIndex ?? d.hIndex),
    i10Index: toInt(d.metrics?.i10Index),
    topWorks: topWorks(works),
  };
}

/** First day of the UTC month, as stored in metric_snapshots.captured_month. */
export function monthStart(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Diff the latest snapshot against the previous one. Returns null when there
 * is nothing worth an email: missing data, mixed sources, or no change at all.
 * A citation total that went DOWN (GS merges/removes papers) is reported as
 * no-change rather than as bad news we can't explain.
 */
export function diffSnapshots(prev: StoredSnapshot, curr: StoredSnapshot): DigestDiff | null {
  if (prev.gs_citations === null || curr.gs_citations === null) return null;
  if (!prev.gs_source || prev.gs_source !== curr.gs_source) return null;

  const citationsDelta = Math.max(0, curr.gs_citations - prev.gs_citations);
  const hChanged = prev.gs_h_index !== null && curr.gs_h_index !== null && curr.gs_h_index > prev.gs_h_index;
  if (citationsDelta === 0 && !hChanged) return null;

  const before = new Map((prev.gs_top_works ?? []).map(w => [w.key, w.citations]));
  let topPaper: DigestDiff["topPaper"] = null;
  for (const w of curr.gs_top_works ?? []) {
    const old = before.get(w.key);
    if (old === undefined) continue;
    const gained = w.citations - old;
    if (gained > 0 && (!topPaper || gained > topPaper.gained)) topPaper = { title: w.title, gained };
  }

  return {
    citationsDelta,
    citationsTotal: curr.gs_citations,
    hIndexBefore: prev.gs_h_index,
    hIndexAfter: curr.gs_h_index,
    topPaper,
  };
}
