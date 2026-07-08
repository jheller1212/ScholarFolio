import type { JournalRanking, OpenAccessStats, OaStatus } from '../../types/scholar';
import { findOpenAlexAuthor, oaFetchJson, OA_API_URL, OA_EMAIL } from './author-lookup';
import { fetchAuthorEnrichmentWorks } from './works';

export { searchOpenAlexAuthors, fetchOpenAlexProfile, OPENALEX_ID_PREFIX, toOpenAlexShortId } from './profile';

export class OpenAlexService {
  /**
   * Search OpenAlex for an author by name + affiliation, return OA stats.
   * Non-blocking — returns null on any failure.
   */
  public async fetchOpenAccessStats(name: string, affiliation: string, publicationTitles?: string[]): Promise<OpenAccessStats | null> {
    try {
      // Use shared author lookup (cached across services)
      const author = await findOpenAlexAuthor(name, affiliation);
      if (!author) return null;
      const authorId = author.id;
      const shortId = authorId.replace('https://openalex.org/', '');

      // When the profile's real publication list is provided, restrict OA stats
      // to works whose title matches it. OpenAlex author disambiguation can merge
      // a different same-named person's works (e.g. an unrelated book) into the
      // record; without this filter those show up in the totals and the
      // repository breakdown. Keyed on the same alphanumeric normalization used
      // for publicationOa below.
      const titleFilter = publicationTitles && publicationTitles.length
        ? new Set(publicationTitles.map(t => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean))
        : null;

      // Kick off the (multi-page) shared works fetch immediately so it runs
      // concurrently with the cheap group_by request below. Also consumed by
      // the field-normalized metrics, so profile load does one works fetch
      // instead of two. oaFetchJson never rejects, so this can safely float
      // across the early returns.
      const worksPromise = fetchAuthorEnrichmentWorks(shortId);

      // Get works grouped by OA status
      const worksUrl = `${OA_API_URL}/works?filter=authorships.author.id:${authorId}&group_by=open_access.oa_status&per_page=10&mailto=${OA_EMAIL}`;
      const worksData = await oaFetchJson<{ group_by?: Array<{ key: string; count: number }> }>(worksUrl);
      if (!worksData) return null;

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

      // Per-publication OA status + DOIs + repository/preprint info from the
      // shared works fetch started above.
      const publicationOa: Record<string, { status: OaStatus; oaUrl?: string }> = {};
      const doiMap: Record<string, string> = {};
      const repositoryCounts: Record<string, number> = {};
      let preprintCount = 0;

      // Filtered OA-status tallies (used instead of the group_by totals when a
      // publication list is supplied, so misattributed works don't count).
      let fTotal = 0, fGold = 0, fGreen = 0, fHybrid = 0, fBronze = 0, fClosed = 0;

      const works = await worksPromise;
      for (const work of works) {
        if (!work.title) continue;
        const normalizedTitle = work.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (titleFilter && !titleFilter.has(normalizedTitle)) continue; // skip misattributed works
        const rawStatus = work.open_access?.oa_status;
        const status: OaStatus = rawStatus === 'diamond'
          ? 'gold'
          : ((rawStatus as OaStatus) || 'closed');
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
        // Tally OA buckets for the filtered total.
        fTotal++;
        if (rawStatus === 'gold' || rawStatus === 'diamond') fGold++;
        else if (rawStatus === 'green') fGreen++;
        else if (rawStatus === 'hybrid') fHybrid++;
        else if (rawStatus === 'bronze') fBronze++;
        else fClosed++;
      }

      // When filtering, report the counts recomputed from the matched works so
      // the headline totals and % exclude misattributed records.
      const useFiltered = !!titleFilter && fTotal > 0;
      const oTotal = useFiltered ? fTotal : total;
      const oGold = useFiltered ? fGold : gold;
      const oGreen = useFiltered ? fGreen : green;
      const oHybrid = useFiltered ? fHybrid : hybrid;
      const oBronze = useFiltered ? fBronze : bronze;
      const oClosed = useFiltered ? fClosed : closed;
      const oOa = oGold + oGreen + oHybrid + oBronze;

      return {
        total: oTotal,
        oa: oOa,
        gold: oGold,
        green: oGreen,
        hybrid: oHybrid,
        bronze: oBronze,
        closed: oClosed,
        oaPercent: oTotal > 0 ? Math.round((oOa / oTotal) * 100) : 0,
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
      // OpenAlex deprecated /venues in favour of /sources; impact_factor is now
      // exposed as summary_stats["2yr_mean_citedness"].
      const data = await oaFetchJson<{ results?: Array<{ x_concepts?: Array<{ score?: number }>; summary_stats?: { '2yr_mean_citedness'?: number } }> }>(
        `${OA_API_URL}/sources?filter=issn:${issn}`
      );
      const source = data?.results?.[0];
      if (!source) return null;

      return {
        sjr: this.mapQuartileToSJR(source.x_concepts?.[0]?.score),
        jcr: source.summary_stats?.['2yr_mean_citedness']?.toFixed(3),
        abdc: this.mapScoreToABDC(source.x_concepts?.[0]?.score)
      };
    } catch (error) {
      console.error('[OpenAlex] Error fetching journal metrics:', error);
      return null;
    }
  }

  public async searchJournal(name: string): Promise<JournalRanking | null> {
    try {
      // OpenAlex deprecated /venues in favour of /sources.
      const data = await oaFetchJson<{ results?: Array<{ x_concepts?: Array<{ score?: number }>; summary_stats?: { '2yr_mean_citedness'?: number } }> }>(
        `${OA_API_URL}/sources?search=${encodeURIComponent(name)}&per_page=1`
      );
      const source = data?.results?.[0];
      if (!source) return null;

      return {
        sjr: this.mapQuartileToSJR(source.x_concepts?.[0]?.score),
        jcr: source.summary_stats?.['2yr_mean_citedness']?.toFixed(3),
        abdc: this.mapScoreToABDC(source.x_concepts?.[0]?.score)
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
