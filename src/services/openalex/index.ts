import { ApiError } from '../../utils/api';
import type { JournalRanking } from '../../types/scholar';
import { rateLimiter } from '../scholar/rate-limiter';

export class OpenAlexService {
  private readonly API_URL = 'https://api.openalex.org';
  private readonly EMAIL = 'research-portfolio@example.com';

  private readonly headers = {
    'User-Agent': `ResearchPortfolio/1.0 (${this.EMAIL})`
  };

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