import { supabase } from './supabase';

type ErrorCategory = 'pindex' | 'profile' | 'auth' | 'openalex' | 's2' | 'navigation' | 'unhandled';

interface ErrorLogPayload {
  category: ErrorCategory;
  message: string;
  stack?: string;
  component?: string;
  action?: string;
  context?: Record<string, unknown>;
}

function parseBrowser(ua: string): string {
  if (ua.includes('Edg/')) return 'Edge ' + (ua.match(/Edg\/([\d.]+)/)?.[1]?.split('.')[0] || '');
  if (ua.includes('SamsungBrowser/')) return 'Samsung ' + (ua.match(/SamsungBrowser\/([\d.]+)/)?.[1] || '');
  if (ua.includes('CriOS/')) return 'Chrome iOS ' + (ua.match(/CriOS\/([\d.]+)/)?.[1]?.split('.')[0] || '');
  if (ua.includes('Chrome/') && !ua.includes('Chromium/')) return 'Chrome ' + (ua.match(/Chrome\/([\d.]+)/)?.[1]?.split('.')[0] || '');
  if (ua.includes('Safari/') && ua.includes('Version/')) return 'Safari ' + (ua.match(/Version\/([\d.]+)/)?.[1]?.split('.').slice(0, 2).join('.') || '');
  if (ua.includes('Firefox/')) return 'Firefox ' + (ua.match(/Firefox\/([\d.]+)/)?.[1]?.split('.')[0] || '');
  return 'Unknown';
}

function parseOS(ua: string): string {
  if (ua.includes('iPhone') || ua.includes('iPad')) {
    const ver = ua.match(/OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, '.') || '';
    return ua.includes('iPad') ? `iPadOS ${ver}` : `iOS ${ver}`;
  }
  if (ua.includes('Mac OS X')) return 'macOS';
  if (ua.includes('Windows NT 10')) return 'Windows 10+';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Android')) return 'Android ' + (ua.match(/Android ([\d.]+)/)?.[1] || '');
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

// Session ID: unique per tab/page load
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Throttle: max 20 errors per session to avoid flooding
let errorCount = 0;
const MAX_ERRORS_PER_SESSION = 20;

// Dedup: don't log the same error twice in a session
const loggedErrors = new Set<string>();

// Aborted fetches (user navigated away, typed a new query, or the component
// unmounted before the request resolved) are expected cancellations, not real
// failures — drop them so genuine errors aren't buried in noise.
function isAbortNoise(message: string): boolean {
  return /\babort(ed)?\b/i.test(message);
}

// Browser-generated messages that say nothing about our code:
//  - the benign ResizeObserver delivery warning browsers emit during layout;
//  - "Script error.", all cross-origin errors are collapsed into this with no
//    stack, so it can never be acted on;
//  - crypto-wallet extensions (MetaMask) inject a script into every page and
//    reject when no wallet is set up. We have no wallet code.
const BROWSER_NOISE = /^(ResizeObserver loop|Script error\.?$|Failed to connect to MetaMask)/i;

/** Reduce a context object to something JSON-serializable. A caller that passes
 *  a DOM node or React element (easy to do by accident in an event handler)
 *  otherwise makes the insert throw "Converting circular structure to JSON"
 *  *inside the logger* — which then surfaced as its own logged error. */
function safeContext(context?: Record<string, unknown>): Record<string, unknown> {
  if (!context) return {};
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === null || value === undefined) continue;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      safe[key] = value;
    } else {
      try {
        safe[key] = JSON.parse(JSON.stringify(value));
      } catch {
        safe[key] = `[unserializable ${t}]`;
      }
    }
  }
  return safe;
}

export function logError(payload: ErrorLogPayload): void {
  if (errorCount >= MAX_ERRORS_PER_SESSION) return;
  if (isAbortNoise(payload.message)) return;
  if (BROWSER_NOISE.test(payload.message.trim())) return;

  // Dedup by category + message
  const dedupeKey = `${payload.category}:${payload.message}`;
  if (loggedErrors.has(dedupeKey)) return;
  loggedErrors.add(dedupeKey);
  errorCount++;

  // The reporter must never become a source of errors itself: everything below
  // runs inside a swallow-all guard.
  try {
    const ua = navigator.userAgent;

    // Fire-and-forget insert
    supabase.from('client_errors').insert({
      category: payload.category,
      message: payload.message.slice(0, 2000),
      stack: payload.stack?.slice(0, 4000),
      component: payload.component,
      action: payload.action,
      context: safeContext(payload.context),
      session_id: sessionId,
      user_agent: ua,
      browser: parseBrowser(ua),
      os: parseOS(ua),
      screen_size: `${window.screen.width}x${window.screen.height}`,
      url: window.location.href,
      referrer: document.referrer || null,
    }).then(() => {}, () => {});
  } catch {
    // Nothing useful to do — reporting failed, the app carries on.
  }
}

/** Log from a caught Error object */
export function logCaughtError(
  error: unknown,
  category: ErrorCategory,
  component: string,
  action: string,
  context?: Record<string, unknown>
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  logError({
    category,
    message: err.message,
    stack: err.stack,
    component,
    action,
    context,
  });
}

// A deploy replaces the hashed chunk files, so a tab open from before it 404s
// when it lazy-loads a route it hasn't touched yet (CitationNetwork,
// CitationsChart). The fix is simply to reload onto the new build — but only
// once per tab, or a genuinely missing chunk would loop forever.
const CHUNK_LOAD_FAILURE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;
const RELOAD_MARKER = 'sf_chunk_reloaded';

function recoverFromStaleChunk(message: string): boolean {
  if (!CHUNK_LOAD_FAILURE.test(message)) return false;
  try {
    if (sessionStorage.getItem(RELOAD_MARKER)) return false;
    sessionStorage.setItem(RELOAD_MARKER, '1');
  } catch {
    return false; // no sessionStorage (private mode) — don't risk a reload loop
  }
  // Small delay so the fire-and-forget error insert isn't cancelled by the
  // navigation — the log is how we see how often deploys strand open tabs.
  setTimeout(() => window.location.reload(), 250);
  return true;
}

/** Install global unhandled error + rejection handlers */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    logError({
      category: 'unhandled',
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      component: event.filename ? `${event.filename}:${event.lineno}` : undefined,
      action: 'unhandled_error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    // Log first, then reload: the record is what tells us how often deploys
    // strand open tabs.
    if (CHUNK_LOAD_FAILURE.test(message)) {
      logError({ category: 'unhandled', message, stack, action: 'stale_chunk' });
      recoverFromStaleChunk(message);
      return;
    }
    logError({
      category: 'unhandled',
      message,
      stack,
      action: 'unhandled_rejection',
    });
  });
}
