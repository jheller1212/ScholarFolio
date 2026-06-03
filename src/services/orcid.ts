const ORCID_BASE = 'https://pub.orcid.org/v3.0';
const ORCID_HEADERS = { Accept: 'application/vnd.orcid+json' };
const TIMEOUT_MS = 10_000;

export interface OrcidEducation {
  degree: string;
  department: string;
  institution: string;
  city: string;
  country: string;
  startYear: number | null;
  endYear: number | null;
}

export interface OrcidEmployment {
  role: string;
  department: string;
  institution: string;
  city: string;
  country: string;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
}

export interface OrcidFunding {
  title: string;
  funder: string;
  type: string;
  startYear: number | null;
  endYear: number | null;
}

export interface OrcidDistinction {
  title: string;
  organization: string;
  year: number | null;
}

export interface OrcidProfile {
  educations: OrcidEducation[];
  employments: OrcidEmployment[];
  fundings: OrcidFunding[];
  distinctions: OrcidDistinction[];
}

const cache = new Map<string, OrcidProfile>();

function parseYear(dateObj: { year?: { value?: string } | null } | null | undefined): number | null {
  const val = dateObj?.year?.value;
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function parseMonth(dateObj: { month?: { value?: string } | null } | null | undefined): number | null {
  const val = dateObj?.['month']?.value;
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { headers: ORCID_HEADERS, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEducations(json: any): OrcidEducation[] {
  const groups = json?.['affiliation-group'] ?? [];
  const results: OrcidEducation[] = [];
  for (const group of groups) {
    for (const summary of group?.summaries ?? []) {
      const ed = summary?.['education-summary'];
      if (!ed) continue;
      results.push({
        degree: ed['role-title'] ?? '',
        department: ed['department-name'] ?? '',
        institution: ed?.organization?.name ?? '',
        city: ed?.organization?.address?.city ?? '',
        country: ed?.organization?.address?.country ?? '',
        startYear: parseYear(ed['start-date']),
        endYear: parseYear(ed['end-date']),
      });
    }
  }
  return results.sort((a, b) => (b.endYear ?? 0) - (a.endYear ?? 0));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEmployments(json: any): OrcidEmployment[] {
  const groups = json?.['affiliation-group'] ?? [];
  const results: OrcidEmployment[] = [];
  for (const group of groups) {
    for (const summary of group?.summaries ?? []) {
      const em = summary?.['employment-summary'];
      if (!em) continue;
      results.push({
        role: em['role-title'] ?? '',
        department: em['department-name'] ?? '',
        institution: em?.organization?.name ?? '',
        city: em?.organization?.address?.city ?? '',
        country: em?.organization?.address?.country ?? '',
        startYear: parseYear(em['start-date']),
        startMonth: parseMonth(em['start-date']),
        endYear: parseYear(em['end-date']),
      });
    }
  }
  // Current positions (endYear === null) first, then by start year desc
  return results.sort((a, b) => {
    if (a.endYear === null && b.endYear !== null) return -1;
    if (a.endYear !== null && b.endYear === null) return 1;
    return (b.startYear ?? 0) - (a.startYear ?? 0);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFundings(json: any): OrcidFunding[] {
  const groups = json?.group ?? [];
  const results: OrcidFunding[] = [];
  for (const group of groups) {
    for (const summary of group?.['funding-summary'] ?? []) {
      results.push({
        title: summary?.title?.title?.value ?? '',
        funder: summary?.organization?.name ?? '',
        type: summary?.type ?? '',
        startYear: parseYear(summary['start-date']),
        endYear: parseYear(summary['end-date']),
      });
    }
  }
  return results.sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDistinctions(json: any): OrcidDistinction[] {
  const groups = json?.['affiliation-group'] ?? [];
  const results: OrcidDistinction[] = [];
  for (const group of groups) {
    for (const summary of group?.summaries ?? []) {
      const dist = summary?.['distinction-summary'];
      if (!dist) continue;
      results.push({
        title: dist['role-title'] ?? '',
        organization: dist?.organization?.name ?? '',
        year: parseYear(dist['start-date']),
      });
    }
  }
  return results.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export async function fetchOrcidProfile(orcidId: string): Promise<OrcidProfile | null> {
  if (cache.has(orcidId)) return cache.get(orcidId)!;

  const endpoints = ['educations', 'employments', 'fundings', 'distinctions'] as const;
  const urls = endpoints.map(ep => `${ORCID_BASE}/${orcidId}/${ep}`);

  try {
    const responses = await Promise.all(urls.map(url => fetchWithTimeout(url)));

    // If any response is 404 treat the ORCID as invalid
    if (responses.some(r => r.status === 404)) return null;

    const jsons = await Promise.all(
      responses.map(r => (r.ok ? r.json() : Promise.resolve(null)))
    );

    if (jsons.every(j => j === null)) return null;

    const [edJson, emJson, fuJson, diJson] = jsons;

    const profile: OrcidProfile = {
      educations: edJson ? parseEducations(edJson) : [],
      employments: emJson ? parseEmployments(emJson) : [],
      fundings: fuJson ? parseFundings(fuJson) : [],
      distinctions: diJson ? parseDistinctions(diJson) : [],
    };

    cache.set(orcidId, profile);
    return profile;
  } catch {
    return null;
  }
}
