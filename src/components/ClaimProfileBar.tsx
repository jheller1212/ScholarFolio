import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { nameToSlug } from '../lib/profileSlug';
import { savePendingAuthIntent, clearPendingAuthIntent, claimIntentFor } from '../lib/pendingAuthIntent';
import { useClaimRequest, consumeClaimRequest } from '../lib/claimRequest';
import { SignUpWall, type SignUpWallOutcome } from './SignUpWall';

interface ClaimProfileBarProps {
  /**
   * Google Scholar id of the profile on screen. Empty for OpenAlex-sourced
   * profiles: their claim id isn't derived reliably yet (see the open draft
   * fixing ProfileView's id parsing), so the bar would lead to a dead end.
   */
  authorId: string;
  authorName: string;
  /** Opens the profile page's own ClaimProfileModal. */
  onOpenClaim: () => void;
}

/**
 * The claim funnel's entry point for logged-out visitors ("Is this you?"),
 * and the hand-off that reopens the claim modal once they come back signed in.
 */
export function ClaimProfileBar({ authorId, authorName, onOpenClaim }: ClaimProfileBarProps) {
  const { user, loading } = useAuth();
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showWall, setShowWall] = useState(false);
  const requested = useClaimRequest();
  const onOpenClaimRef = useRef(onOpenClaim);
  onOpenClaimRef.current = onOpenClaim;

  // Back from sign-up with a claim intent for this profile: open the modal.
  useEffect(() => {
    if (user && requested && consumeClaimRequest(authorId)) onOpenClaimRef.current();
  }, [user, requested, authorId]);

  // Only pitch claiming on profiles nobody owns yet; checked before showing
  // so the bar doesn't flash up on already-claimed profiles.
  useEffect(() => {
    if (user || !authorId) return;
    let cancelled = false;
    setClaimed(null);
    supabase
      .from('claimed_profiles')
      .select('id')
      .eq('author_id', authorId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setClaimed(error ? null : !!data);
      });
    return () => { cancelled = true; };
  }, [user, authorId]);

  const handleWallClose = (outcome: SignUpWallOutcome) => {
    setShowWall(false);
    if (outcome === 'dismissed') clearPendingAuthIntent();
  };

  const slug = nameToSlug(authorName);
  if (loading || user || !authorId || claimed !== false || dismissed || !slug) {
    return showWall ? <SignUpWall onClose={handleWallClose} claimSlug={slug} /> : null;
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#2d7d7d]/20 bg-[#eaf4f4] dark:bg-[#2d7d7d]/15 px-4 py-2.5 text-sm text-[#1e293b] dark:text-gray-200">
        <BadgeCheck className="h-4 w-4 flex-shrink-0 text-[#2d7d7d] dark:text-[#5bbdbd]" />
        <p className="flex-1 min-w-0">
          <span className="font-medium">Is this you?</span>{' '}
          <span className="text-gray-600 dark:text-gray-400">
            Claim <span className="font-medium text-[#2d7d7d] dark:text-[#5bbdbd] break-all">scholarfolio.org/{slug}</span> — free.
          </span>
        </p>
        <button
          onClick={() => {
            savePendingAuthIntent(claimIntentFor(authorId));
            setShowWall(true);
          }}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg transition-colors"
        >
          Claim it
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Hide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {showWall && <SignUpWall onClose={handleWallClose} claimSlug={slug} />}
    </>
  );
}
