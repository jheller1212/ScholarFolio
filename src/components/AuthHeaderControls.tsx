import React, { useState, useEffect } from 'react';
import { Coins, Shield, LogOut, User, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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
  const { user, credits, signOut } = useAuth();
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

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        {anonSearchesUsed > 0 && (
          <span className="text-[10px] text-gray-400 whitespace-nowrap">
            {Math.max(0, anonFreeLimit - anonSearchesUsed)}/{anonFreeLimit} free
          </span>
        )}
        <AuthButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {credits !== null && (
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

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors outline-none">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2d7d7d]/10">
              <User className="h-3.5 w-3.5 text-[#2d7d7d]" />
            </div>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="dropdown-content z-50 min-w-[200px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
            sideOffset={6}
            align="end"
          >
            <DropdownMenu.Label className="px-3 pt-3 pb-1">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                {user.email}
              </p>
              {credits !== null && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {credits} credit{credits !== 1 ? 's' : ''} remaining
                </p>
              )}
            </DropdownMenu.Label>

            <DropdownMenu.Separator className="my-1.5 h-px bg-gray-200 dark:bg-gray-700" />

            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:bg-[#eaf4f4] dark:hover:bg-[#2d7d7d]/20 hover:text-[#2d7d7d] transition-colors"
              onSelect={onBuyCredits}
            >
              <Coins className="h-3.5 w-3.5" />
              Buy credits
            </DropdownMenu.Item>

            {isAdmin && onAdmin && (
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:bg-[#eaf4f4] dark:hover:bg-[#2d7d7d]/20 hover:text-[#2d7d7d] transition-colors"
                onSelect={onAdmin}
              >
                <div className="relative">
                  <Shield className="h-3.5 w-3.5" />
                  {unresolvedCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[12px] h-[12px] flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full px-0.5">
                      {unresolvedCount}
                    </span>
                  )}
                </div>
                Admin Dashboard
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Separator className="my-1.5 h-px bg-gray-200 dark:bg-gray-700" />

            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 outline-none cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              onSelect={signOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </DropdownMenu.Item>

            <div className="h-1.5" />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
