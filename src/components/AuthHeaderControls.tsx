import React from 'react';
import { Coins } from 'lucide-react';
import { AuthButton } from './AuthButton';
import { useAuth } from '../contexts/AuthContext';

interface AuthHeaderControlsProps {
  onBuyCredits: () => void;
  anonSearchesUsed?: number;
  anonFreeLimit?: number;
}

export function AuthHeaderControls({ onBuyCredits, anonSearchesUsed = 0, anonFreeLimit = 3 }: AuthHeaderControlsProps) {
  const { user, credits } = useAuth();

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
      <AuthButton />
    </div>
  );
}
