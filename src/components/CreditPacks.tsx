import { useState } from 'react';
import { X, Shield, Clock, Heart, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuthButton } from './AuthButton';
import { logCaughtError } from '../lib/errorLogger';
import { MONTHLY_FREE_LOOKUPS, SUPPORT_PACKS } from '../lib/constants';
import { formatResetDate, nextAllowanceReset } from '../lib/allowance';

/**
 * Voluntary support for ScholarFolio. Opened from "Support" links, and only
 * opened automatically when a signed-in user has genuinely used up this
 * month's free lookups (and any extras) — never as a paywall in front of a
 * feature.
 */
export function CreditPacks({ onClose }: { onClose: () => void }) {
  const { user, session, credits, allowance } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowanceUsedUp = user !== null && credits !== null && credits <= 0;
  const resetsOn = formatResetDate(allowance?.resetsOn ?? nextAllowanceReset());

  const handleSupport = async (packId: string) => {
    if (!user || !session) return;

    setLoading(packId);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packId }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      logCaughtError(err, 'profile', 'CreditPacks', 'create-checkout');
      setError('Failed to create checkout session. Please try again. (SF-PAY)');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-title"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto modal-card"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#2d7d7d] to-[#1a5c5c] px-6 pt-6 pb-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-5 w-5 text-amber-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-white/80">Support ScholarFolio</span>
          </div>
          <h2 id="support-title" className="text-xl font-bold">
            {allowanceUsedUp ? 'You’ve used this month’s free lookups' : 'Keep ScholarFolio free and open'}
          </h2>
          <p className="text-sm text-white/85 mt-1">
            {allowanceUsedUp
              ? `You’ve used this month’s ${MONTHLY_FREE_LOOKUPS} fresh lookups. Cached profiles, direct profile links and claimed profiles stay free, and your allowance resets on ${resetsOn}. Or support the project and get extra lookups right away.`
              : 'ScholarFolio is free, open source and not a business. Supporting it is entirely optional: every feature stays available to everyone either way.'}
          </p>
        </div>

        {/* Where the money goes */}
        <div className="mx-6 mt-5 flex gap-2.5 text-xs text-gray-600 dark:text-gray-400">
          <Info className="h-4 w-4 flex-shrink-0 text-[#2d7d7d] mt-0.5" />
          <p>
            Every fresh Google Scholar lookup is a paid API call, plus hosting and a domain. Contributions cover those
            costs first; any surplus is donated to open science. Totals are published on the{' '}
            <a href="/about" className="text-[#2d7d7d] hover:underline">About page</a>. Departments and libraries can
            support it as{' '}
            <a href="/institutions" className="text-[#2d7d7d] hover:underline">sustaining members</a>.
          </p>
        </div>

        {!user && (
          <div className="mx-6 mt-4 bg-[#f8fafc] dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Sign in first so the thank-you lookups can be added to your account.
            </p>
            <AuthButton />
          </div>
        )}

        {/* Pay-what-you-want: the two amounts map to the two existing Stripe prices */}
        <div className="px-6 mt-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Choose what you’d like to give</p>
          <div className={`grid grid-cols-2 gap-3 ${!user ? 'opacity-60' : ''}`}>
            {SUPPORT_PACKS.map(pack => (
              <button
                key={pack.id}
                onClick={() => handleSupport(pack.id)}
                disabled={loading !== null || !user}
                className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center transition-colors hover:border-[#2d7d7d] hover:bg-[#eaf4f4]/40 disabled:hover:border-gray-200 disabled:cursor-not-allowed"
              >
                <span className="block text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {loading === pack.id ? '…' : `€${pack.priceEur}`}
                </span>
                <span className="block mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Thank-you: +{pack.extraLookups} extra lookups
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
            Extra lookups are a thank-you, not the product. They never expire and are only used after your
            {` ${MONTHLY_FREE_LOOKUPS}`} free monthly lookups.
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-4 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
        )}

        {/* Trust signals */}
        <div className="px-6 py-4 mt-2">
          <p className="text-[10px] text-gray-400 text-center mb-3">
            One-off payment. Because the thank-you lookups are added immediately as digital content, you waive your 14-day EU withdrawal right (Consumer Rights Directive Art. 16(m)).
          </p>
          <div className="flex items-center justify-center gap-5 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              No subscription
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[11px] text-gray-400">Powered by</span>
            <svg className="h-5" viewBox="0 0 60 25" fill="none">
              <path d="M8.31 5.46C8.31 4.66 8.98 4.09 9.92 4.09C11.4 4.09 13.1 4.69 14.73 5.79L16.07 3.18C14.33 1.84 12.2 1.14 9.96 1.14C6.65 1.14 4.5 3.03 4.5 5.67C4.5 10.37 11.3 9.28 11.3 11.49C11.3 12.44 10.44 12.97 9.37 12.97C7.56 12.97 5.63 12.13 3.83 10.82L2.4 13.39C4.37 15 6.82 15.88 9.22 15.88C12.63 15.88 15.12 14.15 15.12 11.29C15.12 6.35 8.31 7.63 8.31 5.46Z" fill="#6772E5"/>
              <path d="M20.22 6.22L19.88 4.37H17.03V15.63H20.66V8.56C21.5 7.29 22.98 7.56 23.47 7.74V4.37C22.95 4.17 21.13 3.72 20.22 6.22Z" fill="#6772E5"/>
              <path d="M24.69 4.37H28.32V15.63H24.69V4.37ZM24.69 0.57H28.32V3.23H24.69V0.57Z" fill="#6772E5"/>
              <path d="M35.88 4.12C34.58 4.12 33.72 4.73 33.22 5.15L33 4.37H29.93V19.56L33.57 18.8V15.14C34.09 15.49 34.85 15.88 35.94 15.88C38.42 15.88 40.6 13.96 40.6 9.83C40.58 6.09 38.34 4.12 35.88 4.12ZM35.14 12.88C34.44 12.88 34.01 12.65 33.57 12.31V7.67C34.01 7.28 34.46 7.07 35.14 7.07C36.39 7.07 37.23 8.32 37.23 9.96C37.23 11.63 36.41 12.88 35.14 12.88Z" fill="#6772E5"/>
              <path d="M47.95 4.12C44.74 4.12 42.58 6.54 42.58 10.02C42.58 14.1 45.16 15.9 48.3 15.9C49.84 15.9 51 15.56 51.9 15.02L51.56 12.39C50.77 12.82 49.75 13.12 48.58 13.12C47.42 13.12 46.44 12.66 46.31 11.26H52.31C52.31 11.07 52.35 10.35 52.35 9.88C52.35 6.56 50.91 4.12 47.95 4.12ZM46.26 8.8C46.37 7.59 47.03 6.86 47.91 6.86C48.82 6.86 49.4 7.59 49.4 8.8H46.26Z" fill="#6772E5"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
