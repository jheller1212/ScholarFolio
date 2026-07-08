import { useState } from 'react';
import { X, Check, AlertCircle, Loader2, BadgeCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProfileCorrectionModalProps {
  onClose: () => void;
  authorId: string;
  currentName: string;
  currentAffiliation: string;
}

/**
 * Self-service corrections for an ORCID-verified profile owner. Submits
 * descriptive corrections (affiliation, display name) through the claim-profile
 * edge function, which re-checks the verified claim server-side before writing a
 * profile_overrides row (verified_via = 'orcid'). Metrics are never editable.
 */
export function ProfileCorrectionModal({ onClose, authorId, currentName, currentAffiliation }: ProfileCorrectionModalProps) {
  const [affiliation, setAffiliation] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const edits: { field: string; value: string }[] = [];
    if (affiliation.trim()) edits.push({ field: 'affiliation', value: affiliation.trim() });
    if (displayName.trim()) edits.push({ field: 'display_name', value: displayName.trim() });
    if (edits.length === 0) { setError('Enter at least one correction.'); return; }

    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      for (const edit of edits) {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ action: 'correct', authorId, field: edit.field, value: edit.value }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          setError(body.error || 'Could not save your correction.');
          setSaving(false);
          return;
        }
      }
      setDone(true);
      setTimeout(onClose, 1800);
    } catch {
      setError('Could not reach the server. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="correct-title" onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-[#2d7d7d] to-[#1a5c5c] px-6 pt-6 pb-5 text-white">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" aria-label="Close"><X className="h-5 w-5" /></button>
          <div className="flex items-center gap-2 mb-2">
            <BadgeCheck className="h-5 w-5 text-amber-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-white/80">Correct your details</span>
          </div>
          <h2 id="correct-title" className="text-lg font-bold">Fix what the data got wrong</h2>
          <p className="text-sm text-white/80 mt-1">Corrections you make as the verified owner show for everyone. Metrics stay as computed from the source.</p>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="h-7 w-7 text-emerald-600" /></div>
            <p className="text-sm text-gray-700 dark:text-gray-200">Saved. Your corrections will show on the profile shortly.</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label htmlFor="corr-aff" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Affiliation</label>
              <input id="corr-aff" type="text" value={affiliation} onChange={e => setAffiliation(e.target.value)} placeholder={currentAffiliation || 'e.g. Professor, University of …'} maxLength={300}
                className="w-full px-3 py-2.5 text-sm text-gray-900 rounded-lg border border-gray-300 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none transition-colors" />
              <p className="text-[11px] text-gray-400 mt-1">Currently: {currentAffiliation || '—'}</p>
            </div>
            <div>
              <label htmlFor="corr-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Display name</label>
              <input id="corr-name" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={currentName} maxLength={300}
                className="w-full px-3 py-2.5 text-sm text-gray-900 rounded-lg border border-gray-300 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none transition-colors" />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}</div>
            )}

            <button onClick={submit} disabled={saving}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] shadow-md shadow-[#2d7d7d]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : 'Save corrections'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
