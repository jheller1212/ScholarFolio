import { findJournalRanking } from '../../data/journalRankings';
import type { Publication } from '../../types/scholar';

export class ScholarParser {
  private parser: DOMParser;

  constructor() {
    this.parser = new DOMParser();
  }

  public createDOM(html: string): Document {
    return this.parser.parseFromString(html, 'text/html');
  }

  public async parsePublications(html: string): Promise<Publication[]> {
    try {
      const doc = this.createDOM(html);
      const publications: Publication[] = [];

      // Get all publication rows
      const rows = Array.from(doc.querySelectorAll('#gsc_a_b .gsc_a_tr'));
      
      for (const row of rows) {
        try {
          // Parse title and URL
          const titleEl = row.querySelector('.gsc_a_t a');
          const title = titleEl?.textContent?.trim();
          const url = titleEl?.getAttribute('href');
          
          if (!title || !url) {
            console.warn('[ScholarParser] Skipping publication with missing title or URL');
            continue;
          }

          // Parse authors and venue
          const authorVenueElements = row.querySelectorAll('.gsc_a_t .gs_gray');
          const authors = authorVenueElements[0]?.textContent?.split(',').map(a => a.trim()) || [];
          const venue = authorVenueElements[1]?.textContent?.trim() || '';

          // Parse year and citations
          const yearEl = row.querySelector('.gsc_a_y span');
          const citationsEl = row.querySelector('.gsc_a_c');
          
          const yearText = yearEl?.textContent?.trim() || '';
          const citationsText = citationsEl?.textContent?.trim() || '0';

          // Convert year and citations to numbers
          const year = parseInt(yearText);
          const citations = parseInt(citationsText.replace('*', '')) || 0;
          // Skip if no valid year and no citations
          if (isNaN(year) && citations === 0) {
            console.warn(`[ScholarParser] Skipping publication with no year and no citations: ${title}`);
            continue;
          }

          // Create publication object
          const publication: Publication = {
            title,
            authors: authors.length > 0 ? authors : ['Unknown'],
            venue,
            year: (!isNaN(year) && year > 0) ? year : 0,
            citations,
            url: url.startsWith('http') ? url : `https://scholar.google.com${url}`,
            journalRanking: findJournalRanking(venue)
          };

          publications.push(publication);
        } catch (error) {
          console.warn('[ScholarParser] Error parsing publication row:', error);
          continue;
        }
      }

      return publications.sort((a, b) => b.year - a.year);
    } catch (error) {
      console.error('[ScholarParser] Error parsing publications:', error);
      throw new Error('Failed to parse publications data');
    }
  }
}

export const scholarParser = new ScholarParser();