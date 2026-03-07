import { ApiError } from '../../utils/api';

class ScholarFetcher {
  private readonly CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://proxy.cors.sh/',
    'https://cors-anywhere.herokuapp.com/'
  ];
  private readonly TIMEOUT_MS = 20000;

  private validateScholarUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('scholar.google.')) {
        throw new Error('Invalid hostname');
      }
      if (!parsed.pathname.startsWith('/citations')) {
        throw new Error('Invalid path');
      }
    } catch {
      throw new ApiError(
        'Invalid URL. Only Google Scholar profile URLs are allowed.',
        'INVALID_URL'
      );
    }
  }

  private async fetchWithProxy(url: string, proxyIndex: number): Promise<Response> {
    const proxy = this.CORS_PROXIES[proxyIndex];
    const proxyUrl = `${proxy}${encodeURIComponent(url)}`;

    console.log(`[ScholarFetcher] Trying proxy ${proxyIndex + 1}/${this.CORS_PROXIES.length}`);

    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(this.TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  }

  private validateResponse(text: string): void {
    if (!text || text.length < 100) {
      throw new ApiError('Empty or invalid response received', 'INVALID_RESPONSE');
    }

    if (
      text.includes('unusual traffic') ||
      text.includes('please show you') ||
      text.includes('automated access')
    ) {
      throw new ApiError(
        'Rate limited by Google Scholar. Please try again in a few minutes.',
        'RATE_LIMIT'
      );
    }

    if (!text.includes('gsc_prf_in')) {
      if (text.includes('Error 404') || text.includes('page cannot be found')) {
        throw new ApiError(
          'Profile not found. Please check the URL.',
          'PROFILE_NOT_FOUND'
        );
      }

      throw new ApiError(
        'Unable to parse profile data. The profile may be private or the URL may be incorrect.',
        'INVALID_PROFILE'
      );
    }
  }

  /**
   * Fetch any Google Scholar page without profile-specific validation.
   * Used for author search results pages.
   */
  public async fetchRaw(url: string): Promise<string> {
    const errors: string[] = [];

    for (let i = 0; i < this.CORS_PROXIES.length; i++) {
      try {
        const response = await this.fetchWithProxy(url, i);
        const text = await response.text();

        if (!text || text.length < 100) {
          throw new Error('Empty response');
        }
        if (text.includes('unusual traffic') || text.includes('please show you')) {
          throw new ApiError('Rate limited by Google Scholar.', 'RATE_LIMIT');
        }

        return text;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[ScholarFetcher] Proxy ${i + 1} failed (raw): ${msg}`);
        errors.push(msg);

        if (error instanceof ApiError && error.code === 'RATE_LIMIT') {
          throw error;
        }
      }
    }

    throw new ApiError('Could not reach Google Scholar. Please try again.', 'PROXY_ERROR');
  }

  public async fetch(url: string): Promise<string> {
    this.validateScholarUrl(url);

    const errors: string[] = [];

    // Try every proxy. On failure, move to the next one immediately.
    for (let i = 0; i < this.CORS_PROXIES.length; i++) {
      try {
        const response = await this.fetchWithProxy(url, i);
        const text = await response.text();
        this.validateResponse(text);
        console.log('[ScholarFetcher] Successfully fetched profile data');
        return text;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[ScholarFetcher] Proxy ${i + 1} failed: ${msg}`);
        errors.push(msg);

        // Stop immediately for definitive profile errors
        if (error instanceof ApiError &&
            ['PROFILE_NOT_FOUND', 'PRIVATE_PROFILE', 'INVALID_PROFILE'].includes(error.code)) {
          throw error;
        }
      }
    }

    // All proxies failed. Do a second pass with a short delay in case
    // failures were transient (rate limits, temporary outages).
    console.log('[ScholarFetcher] All proxies failed on first pass, retrying...');
    await new Promise(r => setTimeout(r, 3000));

    for (let i = 0; i < this.CORS_PROXIES.length; i++) {
      try {
        const response = await this.fetchWithProxy(url, i);
        const text = await response.text();
        this.validateResponse(text);
        console.log('[ScholarFetcher] Successfully fetched profile data on retry');
        return text;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[ScholarFetcher] Proxy ${i + 1} retry failed: ${msg}`);

        if (error instanceof ApiError &&
            ['PROFILE_NOT_FOUND', 'PRIVATE_PROFILE', 'INVALID_PROFILE'].includes(error.code)) {
          throw error;
        }
        if (error instanceof ApiError && error.code === 'RATE_LIMIT') {
          throw error;
        }
      }
    }

    throw new ApiError(
      'Could not reach Google Scholar. Please try again in a few minutes.',
      'PROXY_ERROR'
    );
  }
}

export const scholarFetcher = new ScholarFetcher();
