import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getEmailPreferences, saveEmailPreferences } from '../lib/emailPreferences';
import { deliverableEmail } from '../lib/accountEmail';
import { DIGEST_DESCRIPTION, DIGEST_STATUS_TEXT, digestStatus } from '../lib/digestConsent';

/**
 * Shown right after a verified claim, the first moment the digest can
 * actually be sent: confirms an earlier opt-in, or offers it. Opting in here
 * is an explicit click, recorded with source 'claim-success'.
 */
export function ClaimDigestOptIn() {
  const { user } = useAuth();
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getEmailPreferences(user.id).then(prefs => setOptedIn(prefs?.digest_opt_in ?? false));
  }, [user]);

  if (!user || optedIn === null) return null;

  const turnOn = async () => {
    setSaving(true);
    setError(null);
    const { error: saveError } = await saveEmailPreferences(user.id, { digest_opt_in: true }, 'claim-success');
    setSaving(false);
    if (saveError) setError('Could not save that. Please try again.');
    else setOptedIn(true);
  };

  if (optedIn) {
    // The claim just succeeded and claims are only stored verified.
    const status = digestStatus({ optedIn, hasVerifiedClaim: true, hasDeliverableEmail: !!deliverableEmail(user.email) });
    return (
      <p className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2" role="status">
        <BellRing className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>{status === 'off' ? null : DIGEST_STATUS_TEXT[status]}</span>
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
        <BellRing className="h-4 w-4 text-[#2d7d7d]" /> Monthly citation updates
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {DIGEST_DESCRIPTION} Optional; unsubscribe anytime.
      </p>
      <button
        onClick={turnOn}
        disabled={saving}
        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#2d7d7d]/30 text-[#2d7d7d] hover:bg-[#eaf4f4] dark:hover:bg-[#2d7d7d]/20 disabled:opacity-50 flex items-center gap-1.5"
      >
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Turn on monthly updates
      </button>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </section>
  );
}
