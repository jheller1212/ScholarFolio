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

export function logError(payload: ErrorLogPayload): void {
  if (errorCount >= MAX_ERRORS_PER_SESSION) return;
  if (isAbortNoise(payload.message)) return;

  // Dedup by category + message
  const dedupeKey = `${payload.category}:${payload.message}`;
  if (loggedErrors.has(dedupeKey)) return;
  loggedErrors.add(dedupeKey);
  errorCount++;

  const ua = navigator.userAgent;

  // Fire-and-forget insert
  supabase.from('client_errors').insert({
    category: payload.category,
    message: payload.message.slice(0, 2000),
    stack: payload.stack?.slice(0, 4000),
    component: payload.component,
    action: payload.action,
    context: payload.context || {},
    session_id: sessionId,
    user_agent: ua,
    browser: parseBrowser(ua),
    os: parseOS(ua),
    screen_size: `${window.screen.width}x${window.screen.height}`,
    url: window.location.href,
    referrer: document.referrer || null,
  }).then(() => {}).catch(() => {});
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
    logError({
      category: 'unhandled',
      message,
      stack,
      action: 'unhandled_rejection',
    });
  });
}
