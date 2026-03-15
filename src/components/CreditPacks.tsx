import React, { useState } from 'react';
import { Coins, Zap, Star, X, ExternalLink } from 'lucide-react';
import { useAuth, supabase } from '../contexts/AuthContext';

const PACKS = [
  { id: 'starter', name: 'Starter', credits: 15, price: 500, label: '5.00' },
  { id: 'pro', name: 'Pro', credits: 40, price: 1000, label: '10.00', popular: true },
] as const;

export function CreditPacks({ onClose }: { onClose: () => void }) {
  const { user, session } = useAuth();
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
        window.open(data.url, '_blank');
      }
    } catch (err) {
      setError('Failed to create checkout session. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Coins className="h-5 w-5 text-[#2d7d7d]" />
            Get more searches
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Credits never expire. Use them whenever you need to explore a scholar profile.
        </p>

        <div className="space-y-3">
          {PACKS.map(pack => (
            <div
              key={pack.id}
              className={`relative border rounded-lg p-4 transition-all ${
                pack.popular
                  ? 'border-[#2d7d7d] bg-[#eaf4f4]/30 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-2.5 right-3 px-2 py-0.5 bg-[#2d7d7d] text-white text-[10px] font-medium rounded-full">
                  Best value
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {pack.popular ? (
                      <Star className="h-4 w-4 text-[#2d7d7d]" />
                    ) : (
                      <Zap className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900">{pack.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {pack.credits} searches
                    <span className="text-gray-400"> &middot; </span>
                    {(pack.price / pack.credits / 100).toFixed(2)}/search
                  </p>
                </div>
                <button
                  onClick={() => handlePurchase(pack.id)}
                  disabled={loading !== null}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    pack.popular
                      ? 'bg-[#2d7d7d] text-white hover:bg-[#1f5c5c]'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {loading === pack.id ? '...' : `€${pack.label}`}
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <p className="mt-4 text-[11px] text-gray-400 text-center">
          Secure payment via Stripe. Credits are added instantly after payment.
        </p>
      </div>
    </div>
  );
}
