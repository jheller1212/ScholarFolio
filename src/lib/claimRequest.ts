import { useSyncExternalStore } from 'react';

/**
 * "Open the claim modal for this author once their profile is on screen."
 *
 * Set by App when it resumes a claim intent after sign-in, consumed by the
 * profile page. A tiny observable store rather than props, because the
 * request is raised in App's effect after the profile view's own effects
 * have already run, so the view has to be told when it changes.
 */
let pendingAuthorId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function requestClaim(authorId: string): void {
  pendingAuthorId = authorId;
  emit();
}

/** True (and cleared) when a claim was requested for exactly this author. */
export function consumeClaimRequest(authorId: string): boolean {
  if (!authorId || pendingAuthorId !== authorId) return false;
  pendingAuthorId = null;
  emit();
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useClaimRequest(): string | null {
  return useSyncExternalStore(subscribe, () => pendingAuthorId, () => null);
}
