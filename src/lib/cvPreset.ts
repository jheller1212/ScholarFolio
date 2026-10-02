import type { NarrativeCvFormat } from '../utils/narrativeCvExport';

// Grant guides (public/guides/) link into the app as /?tab=cv&format=nwo.
// The visitor still has to look up their profile first, and App rewrites the
// URL to /scholar/<id> when a profile loads, so the preset is captured from the
// landing URL into sessionStorage at startup and read back by the profile view.

const STORAGE_KEY = 'sf_cv_preset';
const FORMATS: readonly NarrativeCvFormat[] = ['nwo', 'erc', 'msca'];

export interface CvPreset {
  /** Open the Narrative CV tab on the next profile view. */
  openTab: boolean;
  /** Format card to highlight, if the guide named one we support. */
  format: NarrativeCvFormat | null;
}

export function parseCvPreset(search: string): CvPreset | null {
  const params = new URLSearchParams(search);
  const tab = params.get('tab')?.toLowerCase();
  if (tab !== 'cv' && tab !== 'narrativecv') return null;
  const rawFormat = params.get('format')?.toLowerCase() ?? null;
  const format = FORMATS.find(f => f === rawFormat) ?? null;
  return { openTab: true, format };
}

function write(preset: CvPreset): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
  } catch {
    // Storage blocked (private mode): the preset is a convenience, not required.
  }
}

export function readCvPreset(): CvPreset | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { openTab, format } = parsed as Record<string, unknown>;
    return {
      openTab: openTab === true,
      format: FORMATS.find(f => f === format) ?? null,
    };
  } catch {
    return null;
  }
}

/** Call once at startup, before any history rewrite drops the query string. */
export function captureCvPreset(search: string = window.location.search): void {
  const preset = parseCvPreset(search);
  if (preset) write(preset);
}

/**
 * Mark the tab preset as used so later profiles in the same session open on the
 * default tab again; the format highlight is kept. Idempotent, so it is safe in
 * a React effect (StrictMode runs effects twice).
 */
export function clearCvTabPreset(): void {
  const preset = readCvPreset();
  if (preset?.openTab) write({ ...preset, openTab: false });
}
