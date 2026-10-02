import { useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { takePendingAuthIntent, type PendingAuthIntent } from '../lib/pendingAuthIntent';

/**
 * Once a session appears, hand back whatever the auth wall interrupted —
 * whether sign-in happened in the modal, via the Google redirect, or via an
 * email confirmation link opened in a new tab.
 */
export function useResumeAfterAuth(user: User | null, resume: (intent: PendingAuthIntent) => void): void {
  // Latest callback without re-firing the effect on every render.
  const resumeRef = useRef(resume);
  resumeRef.current = resume;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const intent = takePendingAuthIntent();
    if (intent) resumeRef.current(intent);
  }, [userId]);
}
