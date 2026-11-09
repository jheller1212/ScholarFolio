import { describe, it, expect } from 'vitest';
import { BOT_SAMPLE, MAX_PER_MINUTE, classifyAgent, createLimiter, refererHost } from '../assetHit.ts';

describe('classifyAgent', () => {
  it('treats crawlers, unfurlers, scripts and empty agents as bots', () => {
    expect(classifyAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe('bot');
    expect(classifyAgent('facebookexternalhit/1.1')).toBe('bot');
    expect(classifyAgent('Slackbot-LinkExpanding 1.0')).toBe('bot');
    expect(classifyAgent('Mozilla/5.0 (via ggpht.com GoogleImageProxy)')).toBe('bot');
    expect(classifyAgent('curl/8.4.0')).toBe('bot');
    expect(classifyAgent(undefined)).toBe('bot');
  });

  it('treats ordinary browsers as browsers', () => {
    expect(classifyAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe('browser');
  });
});

describe('refererHost', () => {
  it('keeps only the hostname', () => {
    expect(refererHost('https://www.uni.edu/~ada/private?x=1')).toBe('uni.edu');
    expect(refererHost('garbage')).toBeNull();
    expect(refererHost(undefined)).toBeNull();
  });
});

describe('createLimiter', () => {
  it('samples bots 1 in BOT_SAMPLE and always admits browsers', () => {
    const below = createLimiter(() => 0);
    const above = createLimiter(() => 1 / BOT_SAMPLE);
    expect(below.allow('bot', 0)).toBe(true);
    expect(above.allow('bot', 0)).toBe(false);
    expect(above.allow('browser', 0)).toBe(true);
  });

  it('caps inserts per minute and resets the window', () => {
    const limiter = createLimiter(() => 0);
    for (let i = 0; i < MAX_PER_MINUTE; i++) expect(limiter.allow('browser', 1000)).toBe(true);
    expect(limiter.allow('browser', 1000)).toBe(false);
    expect(limiter.allow('bot', 30_000)).toBe(false);
    expect(limiter.allow('browser', 61_000)).toBe(true);
  });
});
