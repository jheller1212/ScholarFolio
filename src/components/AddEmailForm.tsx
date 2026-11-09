import { useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { checkNewEmail, requestPlaceholderEmailChange } from '../lib/accountEmail';

interface AddEmailFormProps {
  /** Tighter layout for use inside another card (claim success screen). */
  compact?: boolean;
}

/**
 * "Where should we send your updates?" for ORCID-only accounts, whose login
 * address is a placeholder with no mailbox. Secure email change would want a
 * confirmation from that dead address too, so the placeholder-email-change
 * function vouches for the old side and mails a link to the new address only.
 * The address becomes the account's email only once that link is clicked.
 */
export function AddEmailForm({ compact = false }: AddEmailFormProps) {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Supabase keeps an unconfirmed change on the user as new_email.
  const pending = sentTo ?? user?.new_email ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkNewEmail(value);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await requestPlaceholderEmailChange(check.email);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSentTo(check.email);
    setValue('');
  };

  return (
    <div className={compact ? '' : 'rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3'}>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Where should we send your updates?</p>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 mb-2">
        You signed in with ORCID, so we don&apos;t have an email address for you yet.
      </p>
      {pending && (
        <p className="flex items-start gap-1.5 text-xs text-emerald-800 dark:text-emerald-200 mb-2" role="status">
          <MailCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            We sent a confirmation link to <strong>{pending}</strong>. Click it to start receiving email there;
            until then nothing changes and we won&apos;t send anything else. No email after a few minutes? Check your spam folder, or enter it again below.
          </span>
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="email"
          value={value}
          onChange={e => { setValue(e.target.value); setError(null); }}
          placeholder="you@university.edu"
          autoComplete="email"
          aria-label="Your email address"
          className="flex-1 min-w-0 px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d7d7d]/20 focus:border-[#2d7d7d]"
        />
        <button
          type="submit"
          disabled={saving || !value.trim()}
          className="px-3 py-1.5 text-sm font-medium text-white bg-[#2d7d7d] rounded-lg hover:bg-[#1f5c5c] disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? 'Resend' : 'Send link'}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
