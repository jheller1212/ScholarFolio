import { useEffect, useState } from 'react';
import { X, Check, BadgeCheck, Loader2 } from 'lucide-react';
import { OwnerDetailsForm, type OwnerDetails } from './corrections/OwnerDetailsForm';
import { HideWorksPanel } from './corrections/HideWorksPanel';
import { MergeRecordPanel } from './corrections/MergeRecordPanel';
import { fetchProfileOverrides, hiddenWorkTitles } from '../services/corrections';

interface ProfileCorrectionModalProps {
  onClose: () => void;
  authorId: string;
  current: OwnerDetails;
  /** Titles currently on the profile, for the hide-a-paper list. */
  publicationTitles: string[];
}

type Tab = 'details' | 'papers' | 'records';

/**
 * Self-service corrections for an ORCID-verified profile owner: descriptive
 * details (title, affiliation, name, pronouns), hiding papers that aren't
 * theirs, and merging a split OpenAlex record. Everything goes through the claim-profile function, which re-checks
 * the verified claim and validates each value server-side. Metrics are never
 * editable.
 */
export function ProfileCorrectionModal({ onClose, authorId, current, publicationTitles }: ProfileCorrectionModalProps) {
  const [tab, setTab] = useState<Tab>('details');
  const [savedDetails, setSavedDetails] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hidden, setHidden] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfileOverrides(authorId).then(o => { if (!cancelled) setHidden(hiddenWorkTitles(o)); });
    return () => { cancelled = true; };
  }, [authorId]);

  // Corrections are applied when the profile is assembled, so a reload is
  // what shows them; the profile is the owner's own, so it's always free.
  const close = () => { if (dirty) window.location.reload(); else onClose(); };

  const tabClass = (t: Tab) =>
    `flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${tab === t
      ? 'border-[#2d7d7d] text-[#2d7d7d] dark:text-[#5bbdbd]'
      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="correct-title" onClick={close} onKeyDown={e => { if (e.key === 'Escape') close(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-[#2d7d7d] to-[#1a5c5c] px-6 pt-6 pb-5 text-white">
          <button onClick={close} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" aria-label="Close"><X className="h-5 w-5" /></button>
          <div className="flex items-center gap-2 mb-2">
            <BadgeCheck className="h-5 w-5 text-amber-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-white/80">Edit your profile</span>
          </div>
          <h2 id="correct-title" className="text-lg font-bold">Fix what the data got wrong</h2>
          <p className="text-sm text-white/80 mt-1">As the verified owner, your changes show for everyone. Metrics stay as reported by the source.</p>
        </div>

        <div className="flex px-6 border-b border-gray-100 dark:border-slate-700" role="tablist">
          <button role="tab" aria-selected={tab === 'details'} className={tabClass('details')} onClick={() => setTab('details')}>Details &amp; pronouns</button>
          <button role="tab" aria-selected={tab === 'papers'} className={tabClass('papers')} onClick={() => setTab('papers')}>Papers that aren&rsquo;t mine</button>
          <button role="tab" aria-selected={tab === 'records'} className={tabClass('records')} onClick={() => setTab('records')}>Other records</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          {tab === 'details' && (savedDetails ? (
            <div className="py-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="h-6 w-6 text-emerald-600" /></div>
              <p className="text-sm text-gray-700 dark:text-gray-200">Saved. Close this window to see your updated profile.</p>
            </div>
          ) : (
            <OwnerDetailsForm authorId={authorId} current={current} onSaved={() => { setSavedDetails(true); setDirty(true); }} />
          ))}
          {tab === 'papers' && (hidden === null ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : (
            <HideWorksPanel authorId={authorId} visibleTitles={publicationTitles} initialHidden={hidden} onChanged={() => setDirty(true)} />
          ))}
          {tab === 'records' && <MergeRecordPanel onMerged={() => setDirty(true)} />}
        </div>
      </div>
    </div>
  );
}
