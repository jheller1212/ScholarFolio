import { ApiError } from '../../utils/api';
import type { JournalRanking, OpenAccessStats, OaStatus } from '../../types/scholar';
import { rateLimiter } from '../scholar/rate-limiter';

export class OpenAlexService {
  private readonly API_URL = 'https://api.openalex.org';
  private readonly EMAIL = 'scholarfolio@scholarfolio.org';

  private readonly headers = {
    'User-Agent': `ScholarFolio/1.0 (mailto:${this.EMAIL})`
  };

  /**
   * Search OpenAlex for an author by name + affiliation, return OA stats.
   * Non-blocking — returns null on any failure.
   */
  public async fetchOpenAccessStats(name: string, affiliation: string): Promise<OpenAccessStats | null> {
    try {
      // Step 1: Find the author in OpenAlex
      const authorId = await this.findAuthorId(name, affiliation);
      if (!authorId) return null;

      // Step 2: Get works grouped by OA status
      await rateLimiter.acquireToken();
      const worksUrl = `${this.API_URL}/works?filter=authorships.author.id:${authorId}&group_by=open_access.oa_status&per_page=10&mailto=${this.EMAIL}`;
      const worksResponse = await fetch(worksUrl, {
        headers: this.headers,
        signal: AbortSignal.timeout(10000)
      });

      if (!worksResponse.ok) return null;
      const worksData = await worksResponse.json();

      const groups: Record<string, number> = {};
      let total = 0;
      for (const g of worksData.group_by || []) {
        groups[g.key] = g.count;
        total += g.count;
      }

      if (total === 0) return null;

      const gold = (groups['gold'] || 0) + (groups['diamond'] || 0);
      const green = groups['green'] || 0;
      const hybrid = groups['hybrid'] || 0;
      const bronze = groups['bronze'] || 0;
      const closed = groups['closed'] || 0;
      const oa = gold + green + hybrid + bronze;

      // Step 3: Get ORCID from author record
      await rateLimiter.acquireToken();
      const authorResponse = await fetch(`${this.API_URL}/authors/${authorId}?mailto=${this.EMAIL}`, {
        headers: this.headers,
        signal: AbortSignal.timeout(10000)
      });
      let orcid: string | undefined;
      if (authorResponse.ok) {
        const authorData = await authorResponse.json();
        if (authorData.orcid) {
          orcid = authorData.orcid.replace('https://orcid.org/', '');
        }
      }

      // Step 4: Fetch per-publication OA status (paginated, up to 200 works per page)
      const publicationOa: Record<string, { status: OaStatus; oaUrl?: string }> = {};
      let page = 1;
      const maxPages = 10; // Up to 2000 works
      while (page <= maxPages) {
        await rateLimiter.acquireToken();
        const pubsUrl = `${this.API_URL}/works?filter=authorships.author.id:${authorId}&select=title,open_access,publication_year&per_page=200&page=${page}&mailto=${this.EMAIL}`;
        const pubsResponse = await fetch(pubsUrl, {
          headers: this.headers,
          signal: AbortSignal.timeout(15000)
        });
        if (!pubsResponse.ok) break;
        const pubsData = await pubsResponse.json();
        const results = pubsData.results || [];
        if (results.length === 0) break;

        for (const work of results) {
          if (work.title) {
            const normalizedTitle = work.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const status: OaStatus = work.open_access?.oa_status === 'diamond' ? 'gold' : (work.open_access?.oa_status || 'closed');
            publicationOa[normalizedTitle] = {
              status,
              oaUrl: work.open_access?.oa_url || undefined,
            };
          }
        }

        if (results.length < 200) break;
        page++;
      }

      return {
        total,
        oa,
        gold,
        green,
        hybrid,
        bronze,
        closed,
        oaPercent: Math.round((oa / total) * 100),
        orcid,
        publicationOa,
      };
    } catch (error) {
      console.warn('[OpenAlex] Error fetching OA stats:', error);
      return null;
    }
  }

  private async findAuthorId(name: string, affiliation: string): Promise<string | null> {
    await rateLimiter.acquireToken();

    // Search by name, optionally filtered by institution
    let searchUrl = `${this.API_URL}/authors?search=${encodeURIComponent(name)}&per_page=5&mailto=${this.EMAIL}`;

    const response = await fetch(searchUrl, {
      headers: this.headers,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) return null;
    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) return null;
    if (results.length === 1) return results[0].id;

    // Multiple results — try to match by affiliation
    const affiliationLower = affiliation.toLowerCase();
    for (const author of results) {
      const lastInstitution = author.last_known_institutions?.[0]?.display_name?.toLowerCase() || '';
      const allInstitutions = (author.affiliations || []).map((a: any) => a.institution?.display_name?.toLowerCase() || '');
      if (lastInstitution && affiliationLower.includes(lastInstitution)) return author.id;
      if (allInstitutions.some((inst: string) => inst && affiliationLower.includes(inst))) return author.id;
    }

    // No affiliation match — return top result (OpenAlex ranks by relevance)
    return results[0].id;
  }

  public async getJournalMetrics(issn: string): Promise<JournalRanking | null> {
    await rateLimiter.acquireToken();

    try {
      const response = await fetch(
        `${this.API_URL}/venues?filter=issn:${issn}`,
        { headers: this.headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const venue = data.results?.[0];
      
      if (!venue) return null;

      return {
        sjr: this.mapQuartileToSJR(venue.x_concepts?.[0]?.score),
        jcr: venue.impact_factor?.toFixed(3),
        abdc: this.mapScoreToABDC(venue.x_concepts?.[0]?.score)
      };
    } catch (error) {
      console.error('[OpenAlex] Error fetching journal metrics:', error);
      return null;
    }
  }

  public async searchJournal(name: string): Promise<JournalRanking | null> {
    await rateLimiter.acquireToken();

    try {
      const response = await fetch(
        `${this.API_URL}/venues?search=${encodeURIComponent(name)}&per-page=1`,
        { headers: this.headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const venue = data.results?.[0];
      
      if (!venue) return null;

      return {
        sjr: this.mapQuartileToSJR(venue.x_concepts?.[0]?.score),
        jcr: venue.impact_factor?.toFixed(3),
        abdc: this.mapScoreToABDC(venue.x_concepts?.[0]?.score)
      };
    } catch (error) {
      console.error('[OpenAlex] Error searching journal:', error);
      return null;
    }
  }

  private mapQuartileToSJR(score?: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' | undefined {
    if (!score) return undefined;
    if (score >= 0.75) return 'Q1';
    if (score >= 0.5) return 'Q2';
    if (score >= 0.25) return 'Q3';
    return 'Q4';
  }

  private mapScoreToABDC(score?: number): 'A*' | 'A' | 'B' | 'C' | undefined {
    if (!score) return undefined;
    if (score >= 0.85) return 'A*';
    if (score >= 0.7) return 'A';
    if (score >= 0.5) return 'B';
    return 'C';
  }
}

export const openAlexService = new OpenAlexService();