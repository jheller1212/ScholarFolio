import { useState } from 'react';
import { CheckCircle2, Loader2, MailX } from 'lucide-react';

interface UnsubscribePageProps {
  onBack: () => void;
}

type State = 'confirm' | 'working' | 'done' | 'invalid' | 'error';

export function UnsubscribePage({ onBack }: UnsubscribePageProps) {
  // Requires an explicit click — mail scanners (Outlook Safe Links etc.)
  // prefetch and even render links, so auto-firing on load would silently
  // unsubscribe users who never asked to be.
  const token = new URLSearchParams(window.location.search).get('token');
  const [state, setState] = useState<State>(token ? 'confirm' : 'invalid');

  const handleConfirm = () => {
    setState('working');
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(res => setState(res.ok ? 'done' : res.status === 404 || res.status === 400 ? 'invalid' : 'error'))
      .catch(() => setState('error'));
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {state === 'confirm' && (
          <>
            <MailX className="h-10 w-10 text-[#2d7d7d] mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Unsubscribe from emails?</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This stops all ScholarFolio emails (metric updates and product news). You can opt
              back in anytime from the account menu.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Keep emails
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-[#2d7d7d] rounded-lg hover:bg-[#1f5c5c] transition-colors"
              >
                Unsubscribe
              </button>
            </div>
          </>
        )}
        {state === 'working' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-[#2d7d7d] mx-auto mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Updating your email preferences…</p>
          </>
        )}
        {state === 'done' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-[#2d7d7d] mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">You're unsubscribed</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              You won't receive any more emails from ScholarFolio. You can opt back in anytime
              from the account menu.
            </p>
          </>
        )}
        {(state === 'invalid' || state === 'error') && (
          <>
            <MailX className="h-10 w-10 text-gray-400 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {state === 'invalid' ? 'Link not recognized' : 'Something went wrong'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {state === 'invalid'
                ? 'This unsubscribe link is invalid or was already used. You can manage email preferences from the account menu after signing in.'
                : 'We could not update your preferences. Please try the link again in a moment, or manage preferences from the account menu.'}
            </p>
          </>
        )}
        {(state === 'done' || state === 'invalid' || state === 'error') && (
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2d7d7d] rounded-lg hover:bg-[#1f5c5c] transition-colors"
          >
            Back to ScholarFolio
          </button>
        )}
      </div>
    </div>
  );
}
