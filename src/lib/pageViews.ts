import { trackEvent } from './analytics';
import { classifyPageType } from './acquisition';

/**
 * Log a page_view whenever the SPA's route changes. The app routes with
 * history.pushState/replaceState directly (no router), so those are wrapped
 * once here instead of instrumenting every call site. Only the path is sent,
 * never the query string, which can carry profile ids and UTM noise.
 */
let installed = false;
let prevPath: string | null = null;
let prevType: string | null = null;

function emit(viaReplace: boolean): void {
  const path = window.location.pathname;
  if (path === prevPath) return;
  const pageType = classifyPageType(path + window.location.search);
  // replaceState that keeps the page type is a canonicalising redirect
  // (/?user=X -> /scholar/X), not a navigation.
  if (viaReplace && prevType === pageType) {
    prevPath = path;
    return;
  }
  trackEvent('page_view', { path, page_type: pageType, prev_path: prevPath });
  prevPath = path;
  prevType = pageType;
}

export function installPageViewTracking(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const { pushState, replaceState } = window.history;
  window.history.pushState = function (...args: Parameters<History['pushState']>) {
    pushState.apply(this, args);
    emit(false);
  };
  window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
    replaceState.apply(this, args);
    emit(true);
  };
  window.addEventListener('popstate', () => emit(false));
  emit(false);
}
