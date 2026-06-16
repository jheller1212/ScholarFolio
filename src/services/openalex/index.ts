import { timeoutSignal } from '../../utils/api';
import type { JournalRanking, OpenAccessStats, OaStatus } from '../../types/scholar';
import { findOpenAlexAuthor, oaFetchJson, oaRateLimiter, OA_API_URL, OA_EMAIL } from './author-lookup';

export { searchOpenAlexAuthors, fetchOpenAlexProfile, OPENALEX_ID_PREFIX, toOpenAlexShortId } from './profile';

export class OpenAlexService {
  /**
   * Search OpenAlex for an author by name + affiliation, return OA stats.
   * Non-blocking — returns null on any failure.
   */
  public async fetchOpenAccessStats(name: string, affiliation: string): Promise<OpenAccessStats | null> {
    try {
      // Use shared author lookup (cached across services)
      const author = await findOpenAlexAuthor(name, affiliation);
      if (!author) return null;
      const authorId = author.id;

      // Get works grouped by OA status
      await oaRateLimiter.acquireToken();
      const worksUrl = `${OA_API_URL}/works?filter=authorships.author.id:${authorId}&group_by=open_access.oa_status&per_page=10&mailto=${OA_EMAIL}`;
      const worksResponse = await fetch(worksUrl, {
        signal: timeoutSignal(10000)
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

      // ORCID is already fetched by shared author lookup
      const orcid = author.orcid;

      // Fetch per-publication OA status + DOIs + location data (paginated, up to 200 works per page)
      const publicationOa: Record<string, { status: OaStatus; oaUrl?: string }> = {};
      const doiMap: Record<string, string> = {};
      const repositoryCounts: Record<string, number> = {};
      let preprintCount = 0;
      let page = 1;
      const maxPages = 10;
      while (page <= maxPages) {
        await oaRateLimiter.acquireToken();
        const pubsUrl = `${OA_API_URL}/works?filter=authorships.author.id:${authorId}&select=title,open_access,best_oa_location,publication_year,doi&per_page=200&page=${page}&mailto=${OA_EMAIL}`;
        const pubsResponse = await fetch(pubsUrl, {
          signal: timeoutSignal(15000)
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
            // Extract DOI for Semantic Scholar batch lookup
            if (work.doi) {
              const doi = work.doi.replace('https://doi.org/', '');
              if (doi) doiMap[normalizedTitle] = doi;
            }
            // Extract preprint/repository info from best_oa_location
            const boa = work.best_oa_location;
            if (boa?.version === 'submittedVersion') {
              preprintCount++;
            }
            if (boa?.source?.display_name && boa?.is_oa) {
              const repoName = boa.source.display_name;
              repositoryCounts[repoName] = (repositoryCounts[repoName] || 0) + 1;
            }
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
        doiMap,
        preprintCount,
        repositoryCounts,
      };
    } catch (error) {
      console.warn('[OpenAlex] Error fetching OA stats:', error);
      return null;
    }
  }

  public async getJournalMetrics(issn: string): Promise<JournalRanking | null> {
    try {
      const data = await oaFetchJson<{ results?: Array<{ x_concepts?: Array<{ score?: number }>; impact_factor?: number }> }>(
        `${OA_API_URL}/venues?filter=issn:${issn}`
      );
      const venue = data?.results?.[0];
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
    try {
      const data = await oaFetchJson<{ results?: Array<{ x_concepts?: Array<{ score?: number }>; impact_factor?: number }> }>(
        `${OA_API_URL}/venues?search=${encodeURIComponent(name)}&per-page=1`
      );
      const venue = data?.results?.[0];
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
