import React, { useState } from 'react';
import { Zap, Star, X, Shield, Clock, TrendingUp, Check, Sparkles } from 'lucide-react';
import { useAuth, supabase } from '../contexts/AuthContext';

const PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 20,
    price: 500,
    label: '5.00',
    perSearch: '0.25',
    features: [
      '20 profile analyses',
      'Full citation metrics',
      'Co-author network mapping',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    price: 1000,
    label: '10.00',
    perSearch: '0.20',
    popular: true,
    savings: '20',
    features: [
      '50 profile analyses',
      'Full citation metrics',
      'Co-author network mapping',
      'Priority support',
    ],
  },
] as const;

export function CreditPacks({ onClose }: { onClose: () => void }) {
  const { user, session, credits } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (packId: string) => {
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
      setError('Failed to create checkout session. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#2d7d7d] to-[#1a5c5c] px-6 pt-6 pb-8 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-white/80">Unlock more insights</span>
          </div>
          <h2 className="text-xl font-bold">
            You're out of searches
          </h2>
          <p className="text-sm text-white/80 mt-1">
            Top up to keep analyzing scholar profiles with full metrics.
          </p>
          {credits !== null && credits <= 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              0 searches remaining
            </div>
          )}
        </div>

        {/* Packs - side by side */}
        <div className="px-6 -mt-4">
          <div className="grid grid-cols-2 gap-3">
            {PACKS.map(pack => (
              <div
                key={pack.id}
                className={`relative rounded-xl border-2 p-4 transition-all ${
                  pack.popular
                    ? 'border-[#2d7d7d] bg-[#eaf4f4]/40 shadow-lg shadow-[#2d7d7d]/10 scale-[1.02]'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {/* Popular badge */}
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-[#2d7d7d] to-[#3a9a9a] text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm whitespace-nowrap">
                    Most popular
                  </div>
                )}

                {/* Pack name & price */}
                <div className="text-center mt-1">
                  <h3 className={`text-sm font-semibold ${pack.popular ? 'text-[#2d7d7d]' : 'text-gray-700'}`}>
                    {pack.name}
                  </h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">€{pack.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    €{pack.perSearch} per search
                  </div>
                  {pack.popular && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                      <TrendingUp className="h-3 w-3" />
                      Save {pack.savings}%
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="my-3 h-px bg-gray-100" />

                {/* Features */}
                <ul className="space-y-2">
                  {pack.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <Check className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${pack.popular ? 'text-[#2d7d7d]' : 'text-gray-400'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <button
                  onClick={() => handlePurchase(pack.id)}
                  disabled={loading !== null}
                  className={`w-full mt-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    pack.popular
                      ? 'bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] shadow-md shadow-[#2d7d7d]/20 hover:shadow-lg hover:shadow-[#2d7d7d]/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {loading === pack.id ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    `Get ${pack.credits} searches`
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
        )}

        {/* Trust signals */}
        <div className="px-6 py-4 mt-2">
          <div className="flex items-center justify-center gap-5 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Credits never expire
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              Instant delivery
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
