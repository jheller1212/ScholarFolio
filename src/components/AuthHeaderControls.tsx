import React, { useState, useEffect } from 'react';
import { Coins, Shield } from 'lucide-react';
import { AuthButton } from './AuthButton';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = 'jonasheller89@gmail.com';

interface AuthHeaderControlsProps {
  onBuyCredits: () => void;
  onAdmin?: () => void;
  anonSearchesUsed?: number;
  anonFreeLimit?: number;
}

export function AuthHeaderControls({ onBuyCredits, onAdmin, anonSearchesUsed = 0, anonFreeLimit = 3 }: AuthHeaderControlsProps) {
  const { user, credits } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from('profile_reports')
      .select('id', { count: 'exact', head: true })
      .eq('resolved', false)
      .then(({ count }) => { if (count != null) setUnresolvedCount(count); });
  }, [isAdmin]);

  return (
    <div className="flex items-center gap-2">
      {!user && anonSearchesUsed > 0 && (
        <span className="text-[10px] text-gray-400 whitespace-nowrap">
          {Math.max(0, anonFreeLimit - anonSearchesUsed)}/{anonFreeLimit} free
        </span>
      )}
      {user && credits !== null && (
        <button
          onClick={onBuyCredits}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-colors whitespace-nowrap ${
            credits <= 2 && credits > 0
              ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
              : credits <= 0
                ? 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100'
                : 'text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100'
          }`}
          title="Buy more searches"
        >
          <Coins className="h-3 w-3" />
          {credits} credits
        </button>
      )}
      {isAdmin && onAdmin && (
        <button
          onClick={onAdmin}
          className="relative p-1 text-gray-400 hover:text-indigo-600 transition-colors"
          title="Admin Dashboard"
        >
          <Shield className="h-4 w-4" />
          {unresolvedCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5">
              {unresolvedCount}
            </span>
          )}
        </button>
      )}
      <AuthButton />
    </div>
  );
}
