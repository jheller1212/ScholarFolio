import { useEffect, useState } from 'react';
import { MapPin, ExternalLink, Share2, Loader2, BadgeCheck } from 'lucide-react';
import { scholarService } from '../services/scholar';
import { lookupCoAuthorLink, saveCoAuthorLink } from '../services/coauthor-links';
import { fetchClaimStatuses } from '../services/claimed-profiles';
import { openLoadingTab } from '../lib/openCoAuthorProfile';
import { CoAuthorInvite } from './CoAuthorInvite';
import type { CoAuthorGeoData } from '../types/scholar';

interface CoAuthorPopupProps {
  coAuthor: CoAuthorGeoData;
  /** Name of the profile being viewed (the inviter, when canInvite). */
  ownerName: string;
  /** Viewer owns this claimed profile, so "Invite to claim" makes sense. */
  canInvite: boolean;
  onClose: () => void;
}

interface Lookup { loading: boolean; scholarId: string | null; notFound: boolean }

const profileUrl = (scholarId: string) => `${window.location.origin}/scholar/${encodeURIComponent(scholarId)}`;

/** Popup for a co-author dot on the world map: open their profile, link it, invite them. */
export function CoAuthorPopup({ coAuthor, ownerName, canInvite, onClose }: CoAuthorPopupProps) {
  const [lookup, setLookup] = useState<Lookup>({ loading: false, scholarId: null, notFound: false });
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [urlInputError, setUrlInputError] = useState('');
  const searchName = coAuthor.fullName || coAuthor.name;

  // Cheap pre-check (one cached-link row + one claimed_profiles row) so the
  // invite can carry a direct profile link and isn't offered to someone who
  // already claimed theirs. No paid Scholar search happens here.
  useEffect(() => {
    let cancelled = false;
    lookupCoAuthorLink(searchName).then(async link => {
      if (cancelled || !link?.scholar_id) return;
      setLookup(prev => (prev.scholarId ? prev : { loading: false, scholarId: link.scholar_id, notFound: false }));
      const statuses = await fetchClaimStatuses([link.scholar_id]);
      if (!cancelled && statuses.has(link.scholar_id)) setAlreadyClaimed(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [searchName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleView = async () => {
    if (lookup.loading) return;
    if (lookup.scholarId) {
      window.open(profileUrl(lookup.scholarId), '_blank');
      return;
    }
    if (lookup.notFound) {
      setShowUrlInput(true);
      setUrlInputValue('');
      setUrlInputError('');
      return;
    }
    const newWindow = openLoadingTab(coAuthor.name);
    setLookup({ loading: true, scholarId: null, notFound: false });
    try {
      // Community-contributed cache first (the pre-check may still be in flight).
      const cached = await lookupCoAuthorLink(searchName).catch(() => null);
      if (cached?.scholar_id) {
        setLookup({ loading: false, scholarId: cached.scholar_id, notFound: false });
        if (newWindow) newWindow.location.href = profileUrl(cached.scholar_id);
        return;
      }
      // Search with institution for better disambiguation, then name only.
      const queryWithInst = coAuthor.institution ? `${searchName} ${coAuthor.institution}` : searchName;
      let results = await scholarService.searchAuthors(queryWithInst);
      if (results.length === 0 && coAuthor.institution) {
        results = await scholarService.searchAuthors(searchName);
      }
      // Only accept a result whose last name matches.
      const targetLast = searchName.split(/\s+/).pop()?.toLowerCase() ?? '';
      const match = results.find(r => (r.name.split(/\s+/).pop()?.toLowerCase() ?? '') === targetLast);
      if (match) {
        saveCoAuthorLink({ name: searchName, scholarId: match.authorId, openalexId: coAuthor.openalexId, institution: coAuthor.institution }).catch(() => {});
        setLookup({ loading: false, scholarId: match.authorId, notFound: false });
        if (newWindow) newWindow.location.href = profileUrl(match.authorId);
      } else {
        setLookup({ loading: false, scholarId: null, notFound: true });
        newWindow?.close();
      }
    } catch {
      setLookup({ loading: false, scholarId: null, notFound: true });
      newWindow?.close();
    }
  };

  const handleLinkUrl = () => {
    const validation = scholarService.validateProfileUrl(urlInputValue);
    if (!validation.isValid || !validation.userId) {
      setUrlInputError('Please enter a valid Google Scholar profile URL (must contain ?user=...)');
      return;
    }
    const scholarId = validation.userId;
    saveCoAuthorLink({
      name: searchName,
      scholarId,
      scholarUrl: urlInputValue,
      openalexId: coAuthor.openalexId,
      institution: coAuthor.institution,
    }).catch(() => {});
    setLookup({ loading: false, scholarId, notFound: false });
    setShowUrlInput(false);
    window.open(profileUrl(scholarId), '_blank');
  };

  const firstName = coAuthor.name.split(' ')[0];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={coAuthor.name}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{coAuthor.name}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">{coAuthor.institution}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{coAuthor.countryCode}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 -m-1 text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
        {coAuthor.sharedPapers > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 pb-3 border-b border-gray-100 dark:border-slate-700">
            <span className="text-[#2d7d7d] font-medium">{coAuthor.sharedPapers}</span> shared {coAuthor.sharedPapers === 1 ? 'paper' : 'papers'} · {coAuthor.sharedCitations.toLocaleString()} citations
          </div>
        )}
        <div className="space-y-2">
          <button
            onClick={handleView}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] transition-colors"
          >
            {lookup.loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Looking up profile...</>
            ) : lookup.notFound ? (
              <><MapPin className="h-4 w-4" /> Link Google Scholar profile</>
            ) : (
              <><ExternalLink className="h-4 w-4" /> View on ScholarFolio</>
            )}
          </button>

          {showUrlInput && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 space-y-2">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                We couldn't automatically find <strong>{searchName}</strong> on Google Scholar. Multiple authors may share this name. Paste their Google Scholar profile URL below to link it.
              </p>
              <input
                type="url"
                value={urlInputValue}
                onChange={e => { setUrlInputValue(e.target.value); setUrlInputError(''); }}
                placeholder="https://scholar.google.com/citations?user=..."
                className="w-full text-xs px-2.5 py-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-[#2d7d7d] focus:border-[#2d7d7d] outline-none"
              />
              {urlInputError && <p className="text-xs text-red-600 dark:text-red-400">{urlInputError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleLinkUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Link &amp; View
                </button>
                <button
                  onClick={() => window.open(`https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(searchName)}`, '_blank')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Search Scholar
                </button>
              </div>
            </div>
          )}

          {alreadyClaimed ? (
            <p className="flex items-center justify-center gap-1.5 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="h-3.5 w-3.5" /> {firstName} already has a claimed ScholarFolio profile
            </p>
          ) : canInvite ? (
            <CoAuthorInvite
              coAuthorName={coAuthor.name}
              ownerName={ownerName}
              sharedPapers={coAuthor.sharedPapers}
              profileLink={lookup.scholarId ? profileUrl(lookup.scholarId) : null}
            />
          ) : (
            <button
              onClick={() => {
                const text = `Check out your research profile on ScholarFolio: ${window.location.origin}`;
                if (navigator.share) {
                  navigator.share({ title: `${coAuthor.name} — ScholarFolio`, text, url: window.location.origin }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText(text).catch(() => {});
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Share2 className="h-4 w-4" /> Share with {firstName}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
