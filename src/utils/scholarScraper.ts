import { Builder, By, until, WebDriver, WebElement } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import type { Publication } from '../types/scholar';

interface ScrapingResult {
  success: boolean;
  publications: Publication[];
  error?: string;
  totalPublications?: number;
  scrapedPublications?: number;
}

export class ScholarScraper {
  private driver: WebDriver | null = null;
  private readonly maxRetries = 3;
  private readonly pageLoadTimeout = 30000; // 30 seconds
  private readonly elementTimeout = 10000; // 10 seconds
  private readonly scrollDelay = 1000; // 1 second between scrolls
  
  constructor() {
    this.initializeDriver();
  }

  private async initializeDriver() {
    try {
      const options = new ChromeOptions();
      options.addArguments(
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      );
      
      // Add random user agent to avoid detection
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      options.addArguments(`--user-agent=${userAgent}`);

      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

      await this.driver.manage().setTimeouts({
        implicit: this.elementTimeout,
        pageLoad: this.pageLoadTimeout
      });
    } catch (error) {
      throw new Error(`Failed to initialize WebDriver: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async waitForElement(selector: string, timeout = this.elementTimeout): Promise<WebElement> {
    if (!this.driver) throw new Error('WebDriver not initialized');
    
    try {
      return await this.driver.wait(
        until.elementLocated(By.css(selector)),
        timeout,
        `Timeout waiting for element: ${selector}`
      );
    } catch (error) {
      throw new Error(`Element not found: ${selector}`);
    }
  }

  private async isElementPresent(selector: string): Promise<boolean> {
    if (!this.driver) return false;
    
    try {
      await this.waitForElement(selector, 2000);
      return true;
    } catch {
      return false;
    }
  }

  private async checkForRateLimit(): Promise<boolean> {
    const rateLimitIndicators = [
      'unusual traffic',
      'please show you're not a robot',
      'complete a captcha',
      'automated requests'
    ];

    if (!this.driver) return false;
    
    const pageSource = await this.driver.getPageSource();
    return rateLimitIndicators.some(indicator => 
      pageSource.toLowerCase().includes(indicator)
    );
  }

  private async scrollToBottom(): Promise<void> {
    if (!this.driver) return;

    let lastHeight = 0;
    let currentHeight = await this.driver.executeScript(
      'return document.documentElement.scrollHeight'
    );

    while (lastHeight !== currentHeight) {
      lastHeight = currentHeight;
      
      await this.driver.executeScript(
        'window.scrollTo(0, document.documentElement.scrollHeight);'
      );
      
      // Wait for potential lazy loading
      await new Promise(resolve => setTimeout(resolve, this.scrollDelay));
      
      currentHeight = await this.driver.executeScript(
        'return document.documentElement.scrollHeight'
      );
    }
  }

  private async clickShowMoreButton(): Promise<boolean> {
    try {
      const showMoreButton = await this.waitForElement('#gsc_bpf_more');
      const isVisible = await showMoreButton.isDisplayed();
      
      if (isVisible) {
        await showMoreButton.click();
        await new Promise(resolve => setTimeout(resolve, this.scrollDelay));
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private async extractPublicationData(element: WebElement): Promise<Publication> {
    const title = await element.findElement(By.css('.gsc_a_t a'))
      .getText()
      .catch(() => '');
      
    const authors = await element.findElement(By.css('.gsc_a_t div'))
      .getText()
      .then(text => text.split(',').map(a => a.trim()))
      .catch(() => []);
      
    const venue = await element.findElement(By.css('.gsc_a_t .gs_gray:last-child'))
      .getText()
      .catch(() => '');
      
    const year = await element.findElement(By.css('.gsc_a_y span'))
      .getText()
      .then(text => parseInt(text) || 0)
      .catch(() => 0);
      
    const citations = await element.findElement(By.css('.gsc_a_c'))
      .getText()
      .then(text => parseInt(text) || 0)
      .catch(() => 0);
      
    const url = await element.findElement(By.css('.gsc_a_t a'))
      .getAttribute('href')
      .then(href => href ? `https://scholar.google.com${href}` : '')
      .catch(() => '');

    return {
      title,
      authors,
      year,
      citations,
      venue,
      url
    };
  }

  private async getTotalPublicationCount(): Promise<number> {
    try {
      const countElement = await this.waitForElement('#gsc_a_nn');
      const countText = await countElement.getText();
      return parseInt(countText) || 0;
    } catch {
      return 0;
    }
  }

  public async scrapeProfile(url: string): Promise<ScrapingResult> {
    if (!this.driver) {
      return {
        success: false,
        publications: [],
        error: 'WebDriver not initialized'
      };
    }

    let retryCount = 0;
    let publications: Publication[] = [];

    while (retryCount < this.maxRetries) {
      try {
        // Navigate to profile
        await this.driver.get(url);
        
        // Check for rate limiting
        if (await this.checkForRateLimit()) {
          throw new Error('Rate limit detected');
        }

        // Get total publication count
        const totalPublications = await this.getTotalPublicationCount();

        // Keep clicking "Show more" until all publications are loaded
        let hasMore = true;
        while (hasMore) {
          await this.scrollToBottom();
          hasMore = await this.clickShowMoreButton();
          
          // Check for rate limiting after each action
          if (await this.checkForRateLimit()) {
            throw new Error('Rate limit detected during pagination');
          }
        }

        // Extract all publications
        const publicationElements = await this.driver.findElements(
          By.css('#gsc_a_b .gsc_a_tr')
        );

        const allPubs = await Promise.all(
          publicationElements.map(element => this.extractPublicationData(element))
        );
        // Skip publications with no year and no citations
        publications = allPubs.filter(p => (p.year > 0) || (p.citations > 0));

        // Verify we got all publications
        if (totalPublications > 0 && publications.length < totalPublications) {
          throw new Error(
            `Only scraped ${publications.length} of ${totalPublications} publications`
          );
        }

        return {
          success: true,
          publications,
          totalPublications,
          scrapedPublications: publications.length
        };

      } catch (error) {
        retryCount++;
        
        if (retryCount === this.maxRetries) {
          return {
            success: false,
            publications: [],
            error: `Scraping failed after ${this.maxRetries} attempts: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
      }
    }

    return {
      success: false,
      publications: [],
      error: 'Maximum retry attempts exceeded'
    };
  }

  public async close(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
    }
  }
}

// Export a singleton instance
export const scholarScraper = new ScholarScraper();