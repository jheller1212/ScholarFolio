// Server-side `asset_hit` analytics for the embeddable badge and the OG share
// card, written to the same analytics_events table (public insert, no user id,
// no session id, no IP). These URLs are fetched by crawlers and link
// unfurlers far more than by people, so logging is sampled and capped per
// warm container: a bot storm costs a bounded number of rows, not one per hit.
//
// Counts are origin hits only: CDN, browser and image-proxy caches (GitHub
// camo, Gmail) answer most requests without invoking the function, so read
// them as relative signals (which profiles/sites embed), not view totals.

export type AssetKind = 'badge' | 'og_image';
export type AgentClass = 'bot' | 'browser';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable key: public by design, the app bundle ships the same value.
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

/** Log 1 in BOT_SAMPLE bot hits; each logged row carries `sample` to scale back up. */
export const BOT_SAMPLE = 10;
/** Hard cap on inserts per container per minute, whatever the traffic. */
export const MAX_PER_MINUTE = 30;

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|skype|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|headless|lighthouse|monitor|uptime|scan|fetch|proxy|camo|googleimageproxy/i;

export function classifyAgent(userAgent: string | null | undefined): AgentClass {
  if (!userAgent) return 'bot';
  return BOT_RE.test(userAgent) ? 'bot' : 'browser';
}

/** Hostname only; a full referrer URL could carry someone's private page path. */
export function refererHost(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

export interface Limiter {
  /** True when this hit should be written. */
  allow(agent: AgentClass, now?: number): boolean;
}

export function createLimiter(random: () => number = Math.random): Limiter {
  let windowStart = 0;
  let used = 0;
  return {
    allow(agent, now = Date.now()) {
      if (agent === 'bot' && random() >= 1 / BOT_SAMPLE) return false;
      if (now - windowStart >= 60_000) {
        windowStart = now;
        used = 0;
      }
      if (used >= MAX_PER_MINUTE) return false;
      used++;
      return true;
    },
  };
}

const limiter = createLimiter();

/**
 * Record an asset hit. Awaitable but bounded (a short timeout) so it can never
 * hold up the image response for long; failures are swallowed.
 */
export async function logAssetHit(
  kind: AssetKind,
  authorId: string,
  headers: { userAgent: string | null | undefined; referer: string | null | undefined },
): Promise<void> {
  const agent = classifyAgent(headers.userAgent);
  if (!limiter.allow(agent)) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        event: 'asset_hit',
        properties: {
          kind,
          // The og-image id comes straight from the URL; bound it.
          author_id: authorId.slice(0, 64),
          referrer_host: refererHost(headers.referer),
          agent,
          sample: agent === 'bot' ? BOT_SAMPLE : 1,
        },
      }),
      signal: AbortSignal.timeout(800),
    });
  } catch {
    // Analytics must never break the asset.
  }
}
