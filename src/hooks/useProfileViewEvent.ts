import { useEffect, useRef } from 'react';
import { trackEvent } from '../lib/analytics';
import { takePendingProfileEntry } from '../lib/entryAttribution';

interface ClaimState {
  /** The claimed_profiles lookup for this author has finished. */
  checked: boolean;
  isClaimed: boolean;
  isOwner: boolean;
}

/**
 * Log one profile_view per mounted profile, once its claim status is known
 * (is_claimed / is_owner are only meaningful after that lookup).
 */
export function useProfileViewEvent(authorId: string, claim: ClaimState): void {
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (!authorId || !claim.checked || tracked.current === authorId) return;
    tracked.current = authorId;
    trackEvent('profile_view', {
      author_id: authorId,
      source: authorId.startsWith('openalex:') ? 'openalex' : 'gs',
      is_claimed: claim.isClaimed,
      is_owner: claim.isOwner,
      entry: takePendingProfileEntry(),
    });
  }, [authorId, claim.checked, claim.isClaimed, claim.isOwner]);
}
