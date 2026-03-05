import { ApiError } from '../../utils/api';

class ScholarFetcher {
  // Use a more reliable CORS proxy
  private readonly CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest='
  ];
  private readonly MAX_RETRIES = 5; // Increased from 3
  private readonly INITIAL_DELAY_MS = 2000; // Increased from 1000

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

  private async fetchWithProxy(url: string, attempt: number): Promise<Response> {
    // Validate URL before proxying to prevent SSRF
    this.validateScholarUrl(url);

    // Try each proxy in sequence until one works
    const proxyIndex = (attempt - 1) % this.CORS_PROXIES.length;
    const proxyUrl = `${this.CORS_PROXIES[proxyIndex]}${encodeURIComponent(url)}`;
    
    try {
      console.log(`[ScholarFetcher] Using proxy ${proxyIndex + 1}/${this.CORS_PROXIES.length}`);
      
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        if (response.status === 429 || response.status === 403) {
          throw new ApiError('Rate limited. Please try again in a few minutes.', 'RATE_LIMIT');
        }
        if (response.status === 404) {
          throw new ApiError('Profile not found. Please check the URL.', 'PROFILE_NOT_FOUND');
        }
        if (response.status >= 500) {
          throw new Error(`Server error (${response.status})`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error; // Don't retry API errors
      }
      
      // Handle timeout errors
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        console.warn('[ScholarFetcher] Request timed out');
        throw new Error('Request timed out');
      }

      const isNetworkError = (
        error instanceof TypeError && 
        (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('timeout'))
      );

      if (isNetworkError && attempt < this.MAX_RETRIES) {
        console.warn(`[ScholarFetcher] Network error on attempt ${attempt}, will retry with different proxy`);
        throw error; // Allow retry for network errors
      }
      
      throw new ApiError(
        'Failed to connect to Google Scholar. Please check your internet connection and try again.',
        'NETWORK_ERROR'
      );
    }
  }

  private async delay(attempt: number): Promise<void> {
    // Implement exponential backoff with jitter and increased delays
    const jitter = Math.random() * 2000; // Increased jitter
    const delay = (this.INITIAL_DELAY_MS * Math.pow(2, attempt - 1)) + jitter;
    const maxDelay = 30000; // Cap at 30 seconds
    await new Promise(resolve => setTimeout(resolve, Math.min(delay, maxDelay)));
  }

  private validateResponse(text: string): void {
    if (!text || text.length < 100) {
      throw new ApiError('Empty or invalid response received', 'INVALID_RESPONSE');
    }

    // Enhanced detection of various error states
    if (
      text.includes('unusual traffic') || 
      text.includes('please show you') ||
      text.includes('automated access') ||
      text.includes('blocked')
    ) {
      throw new ApiError(
        'Rate limited by Google Scholar. Please try again in a few minutes.',
        'RATE_LIMIT'
      );
    }

    if (
      text.includes('not found') || 
      text.includes('Error 404') ||
      text.includes('page cannot be found')
    ) {
      throw new ApiError(
        'Profile not found. Please check the URL.',
        'PROFILE_NOT_FOUND'
      );
    }

    if (!text.includes('gsc_prf_in')) {
      // Check for specific indicators of a private profile
      if (text.includes('private') || text.includes('no public access')) {
        throw new ApiError(
          'This profile is private and cannot be accessed.',
          'PRIVATE_PROFILE'
        );
      }
      
      throw new ApiError(
        'Unable to parse profile data. The profile may be private or the URL may be incorrect.',
        'INVALID_PROFILE'
      );
    }
  }

  public async fetch(url: string): Promise<string> {
    let lastError: Error | null = null;
    let consecutiveProxyFailures = 0;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`[ScholarFetcher] Attempt ${attempt}/${this.MAX_RETRIES}`);
        
        if (attempt > 1) {
          await this.delay(attempt);
        }

        const response = await this.fetchWithProxy(url, attempt);
        const text = await response.text();

        // Reset proxy failures counter on successful fetch
        consecutiveProxyFailures = 0;

        // Validate the response content
        this.validateResponse(text);

        console.log('[ScholarFetcher] Successfully fetched and validated profile data');
        return text;

      } catch (error) {
        console.warn(`[ScholarFetcher] Attempt ${attempt} failed:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof ApiError) {
          // Don't retry on specific API errors
          if (['PROFILE_NOT_FOUND', 'PRIVATE_PROFILE', 'INVALID_PROFILE'].includes(error.code)) {
            throw error;
          }
          // For rate limiting, wait longer before retrying
          if (error.code === 'RATE_LIMIT') {
            await this.delay(attempt + 2); // Add extra delay for rate limits
          }
        }

        // Track consecutive proxy failures
        consecutiveProxyFailures++;
        
        // If all proxies have failed consecutively, throw error
        if (consecutiveProxyFailures >= this.CORS_PROXIES.length) {
          throw new ApiError(
            'All available proxies failed. Please try again later.',
            'PROXY_ERROR'
          );
        }

        // Only retry if we haven't reached max retries
        if (attempt === this.MAX_RETRIES) {
          throw new ApiError(
            'Failed to fetch profile data after multiple attempts. Please try again later.',
            'MAX_RETRIES_EXCEEDED'
          );
        }
      }
    }

    // This should never be reached due to the throw in the loop, but TypeScript needs it
    throw lastError || new ApiError(
      'An unexpected error occurred while fetching the profile.',
      'UNKNOWN_ERROR'
    );
  }
}

export const scholarFetcher = new ScholarFetcher();