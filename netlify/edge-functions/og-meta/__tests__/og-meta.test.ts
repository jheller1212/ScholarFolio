import { describe, expect, it } from 'vitest';
import { buildHead, injectHead, slugToName } from '../head.ts';
import { answerAgent, resolveProfileTarget, wantsHead, wantsText } from '../routes.ts';

const q = (s = '') => new URLSearchParams(s);

describe('resolveProfileTarget', () => {
  it('resolves canonical /scholar/<id> paths', () => {
    expect(resolveProfileTarget('/scholar/NOSPtp8AAAAJ', q())).toEqual({ kind: 'id', id: 'NOSPtp8AAAAJ' });
    expect(resolveProfileTarget('/scholar/openalex%3AA123/', q())).toEqual({ kind: 'id', id: 'openalex:A123' });
  });

  it('resolves the legacy ?user= form on the root only', () => {
    expect(resolveProfileTarget('/', q('user=abc123456789'))).toEqual({ kind: 'id', id: 'abc123456789' });
    expect(resolveProfileTarget('/', q())).toBeNull();
  });

  it('treats slug-shaped paths as vanity slugs', () => {
    expect(resolveProfileTarget('/jonas-heller', q())).toEqual({ kind: 'slug', slug: 'jonas-heller' });
    expect(resolveProfileTarget('/jonas-heller/', q())).toEqual({ kind: 'slug', slug: 'jonas-heller' });
  });

  it('never treats app routes, assets or nested paths as slugs', () => {
    for (const p of ['/privacy', '/terms', '/about', '/trending', '/changelog', '/guides', '/api',
      '/badge', '/favicon.svg', '/og-default.png', '/assets/index-abc.js', '/guides/h-index',
      '/Jonas-Heller', '/a', '/scholar/', '/-bad']) {
      expect(resolveProfileTarget(p, q())).toBeNull();
    }
  });

  it('rejects malformed percent-encoding', () => {
    expect(resolveProfileTarget('/scholar/%E0%A4%A', q())).toBeNull();
  });
});

describe('buildHead', () => {
  it('canonicalizes claimed profiles to their slug and includes metrics', () => {
    const { tags, title } = buildHead({
      data: { name: 'Ada Lovelace', affiliation: 'Analytical Engine Society', totalCitations: 12345, hIndex: 42 },
      authorId: 'ABCDEF123456',
      claimedSlug: 'ada-lovelace',
    });
    expect(title).toBe('Ada Lovelace — ScholarFolio');
    expect(tags).toContain('href="https://scholarfolio.org/ada-lovelace"');
    expect(tags).toContain('12,345 citations · h-index 42');
    expect(tags).toContain('"@type":"Person"');
    expect(tags).toContain('content="https://scholarfolio.org/og/ABCDEF123456.png?v=12345-42"');
    expect(tags).toContain('content="summary_large_image"');
  });

  it('keeps the default card for anonymous and OpenAlex-only profiles', () => {
    expect(buildHead({ data: {}, authorId: 'X', claimedSlug: null }).tags).toContain('og-default.png');
    expect(buildHead({ data: { name: 'B' }, authorId: 'openalex:A1', claimedSlug: null }).tags).toContain('og-default.png');
  });

  it('falls back to the claimed name when the profile is not cached', () => {
    const { title, tags } = buildHead({ data: {}, authorId: 'X', claimedSlug: 'jonas-heller', fallbackName: slugToName('jonas-heller') });
    expect(title).toBe('Jonas Heller — ScholarFolio');
    expect(tags).toContain('Jonas Heller on ScholarFolio.');
  });

  it('escapes cached text so it cannot break out of attributes or the JSON-LD script', () => {
    const { tags } = buildHead({ data: { name: 'Evil "</script><b>' }, authorId: 'X', claimedSlug: null });
    expect(tags).not.toContain('</script><b>');
    expect(tags).toContain('&quot;&lt;/script&gt;');
  });
});

describe('injectHead', () => {
  it('replaces the static title, description and og tags', () => {
    const html = '<html><head><title>Old</title><meta name="description" content="x" /><meta property="og:title" content="Old" /></head><body></body></html>';
    const out = injectHead(html, '<meta property="og:title" content="New" />', 'New');
    expect(out).toContain('<title>New</title>');
    expect(out).not.toContain('content="Old"');
    expect(out).not.toContain('name="description"');
  });
});

describe('agent routing', () => {
  it('gives answer engines the text body, including browser-shaped user agents', () => {
    for (const ua of ['ChatGPT-User/1.0', 'OAI-SearchBot/1.0', 'PerplexityBot/1.0', 'Claude-User/1.0',
      'Claude-SearchBot/1.0', 'Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
      'Mozilla/5.0 (compatible; Googlebot/2.1)']) {
      expect(wantsText(ua)).toBe(true);
      expect(wantsHead(ua)).toBe(true);
    }
  });

  it('gives preview bots the head only', () => {
    expect(wantsHead('LinkedInBot/1.0')).toBe(true);
    expect(wantsText('LinkedInBot/1.0')).toBe(false);
  });

  it('passes humans and robots-blocked training crawlers straight through', () => {
    for (const ua of ['Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36', 'GPTBot/1.2', 'ClaudeBot/1.0', 'CCBot/2.0']) {
      expect(wantsHead(ua)).toBe(false);
    }
  });
});

describe('answerAgent', () => {
  it('names answer engines and ignores search engines and people', () => {
    expect(answerAgent('Mozilla/5.0 (compatible; ChatGPT-User/1.0)')).toBe('chatgpt-user');
    expect(answerAgent('Claude-User/1.0')).toBe('claude-user');
    expect(answerAgent('Googlebot/2.1')).toBeNull();
    expect(answerAgent('Mozilla/5.0 Chrome/130')).toBeNull();
  });
});
