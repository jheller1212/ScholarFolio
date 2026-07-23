import { useEffect, useState } from 'react';
import { X, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getEmailPreferences, saveEmailPreferences } from '../lib/emailPreferences';

interface EmailPreferencesModalProps {
  onClose: () => void;
}

export function EmailPreferencesModal({ onClose }: EmailPreferencesModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [digest, setDigest] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getEmailPreferences(user.id).then(prefs => {
      if (prefs) {
        setDigest(prefs.digest_opt_in);
        setMarketing(prefs.marketing_opt_in);
      }
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await saveEmailPreferences(
      user.id,
      { digest_opt_in: digest, marketing_opt_in: marketing },
      'settings'
    );
    setSaving(false);
    if (saveError) {
      setError('Could not save your preferences. Please try again.');
    } else {
      setSaved(true);
      setTimeout(onClose, 900);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-prefs-title"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 id="email-prefs-title" className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            <Mail className="h-4 w-4 text-[#2d7d7d]" />
            Email preferences
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <label className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={digest}
                onChange={e => setDigest(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#2d7d7d] focus:ring-[#2d7d7d]"
              />
              <span>
                <strong>Metric updates</strong>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Email me when my citation metrics change.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={marketing}
                onChange={e => setMarketing(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#2d7d7d] focus:ring-[#2d7d7d]"
              />
              <span>
                <strong>Product news</strong>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Occasional ScholarFolio feature announcements.</span>
              </span>
            </label>

            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-4">
              You can change these anytime here or via the unsubscribe link in any email we send.
            </p>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-3">{error}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="w-full py-2 text-sm font-medium text-white bg-[#2d7d7d] rounded-lg hover:bg-[#1f5c5c] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save preferences'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
