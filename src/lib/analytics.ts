import { supabase } from './supabase';

const SESSION_KEY = 'sf_attribution';

interface Attribution {
  referrer: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_page: string;
  timestamp: string;
}

/** Capture referrer + UTM on first page load (once per session) */
export function captureAttribution(): void {
  if (sessionStorage.getItem(SESSION_KEY)) return;

  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {
    referrer: document.referrer || 'direct',
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    landing_page: window.location.pathname + window.location.search,
    timestamp: new Date().toISOString(),
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(attribution));

  // Log the visit event
  trackEvent('visit', {
    referrer: attribution.referrer,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    landing_page: attribution.landing_page,
  });
}

function getAttribution(): Attribution | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSessionId(): string {
  let sid = sessionStorage.getItem('sf_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('sf_session_id', sid);
  }
  return sid;
}

/** Log an analytics event with attribution context */
export function trackEvent(
  event: string,
  properties: Record<string, unknown> = {}
): void {
  const attribution = getAttribution();
  const sessionId = getSessionId();

  // Merge attribution into properties for events that benefit from it
  const enriched = { ...properties };
  if (attribution && event !== 'visit') {
    enriched._referrer = attribution.referrer;
    enriched._utm_source = attribution.utm_source;
    enriched._utm_medium = attribution.utm_medium;
    enriched._utm_campaign = attribution.utm_campaign;
  }

  // Fire-and-forget insert
  supabase
    .from('analytics_events')
    .insert({
      event,
      properties: enriched,
      session_id: sessionId,
      referrer: attribution?.referrer || document.referrer || null,
      pathname: window.location.pathname,
    })
    .then(() => {})
    .catch(() => {});
}
