import { createClient } from '@supabase/supabase-js';

// Own Supabase client to avoid circular dependency with AuthContext
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Lightweight session ID (persists per tab, resets on close)
const SESSION_ID =
  sessionStorage.getItem('sf_sid') ??
  (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem('sf_sid', id);
    return id;
  })();

type FunnelEvent =
  | 'page_view'
  | 'search_anonymous'
  | 'search_authenticated'
  | 'signup_wall_shown'
  | 'signup_completed'
  | 'paywall_shown'
  | 'credit_packs_opened'
  | 'checkout_started'
  | 'purchase_completed';

export function trackEvent(
  event: FunnelEvent,
  properties?: Record<string, unknown>,
) {
  // Fire-and-forget — never block the UI
  supabase
    .from('analytics_events')
    .insert({
      event,
      properties: properties ?? {},
      session_id: SESSION_ID,
      referrer: document.referrer || null,
      pathname: window.location.pathname,
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        console.warn('[analytics]', event, error.message);
      }
    });
}
