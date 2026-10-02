import { useState } from 'react';
import { Send, Check } from 'lucide-react';
import { buildInviteMessage } from '../lib/coAuthorInvite';
import { trackEvent } from '../lib/analytics';

interface CoAuthorInviteProps {
  coAuthorName: string;
  ownerName: string;
  sharedPapers: number;
  profileLink: string | null;
}

/**
 * "Invite to claim" for co-authors who haven't claimed their profile. Uses the
 * share sheet where available, else the clipboard, else shows the text to copy
 * by hand (clipboard access is often blocked in social in-app browsers).
 */
export function CoAuthorInvite({ coAuthorName, ownerName, sharedPapers, profileLink }: CoAuthorInviteProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const message = buildInviteMessage({ coAuthorName, ownerName, sharedPapers, profileLink, siteUrl: window.location.origin });
  const firstName = coAuthorName.split(' ')[0];

  // Names stay out of analytics; we only learn whether the loop is used.
  const track = (method: 'share' | 'copy' | 'manual') =>
    trackEvent('coauthor_invite', { method, has_profile_link: !!profileLink });

  const handleInvite = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Your ScholarFolio profile', text: message });
        track('share');
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return; // user cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setStatus('copied');
      track('copy');
    } catch {
      setStatus('manual');
      track('manual');
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleInvite}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border border-[#2d7d7d]/30 text-[#2d7d7d] dark:text-[#5bbdbd] hover:bg-[#eaf4f4] dark:hover:bg-[#2d7d7d]/15 transition-colors"
      >
        {status === 'copied'
          ? <><Check className="h-4 w-4" /> Invite copied — paste it to {firstName}</>
          : <><Send className="h-4 w-4" /> Invite {firstName} to claim their profile</>}
      </button>
      {status === 'manual' && (
        <textarea
          readOnly
          value={message}
          rows={7}
          onFocus={e => e.currentTarget.select()}
          aria-label="Invitation message to copy"
          className="w-full text-xs p-2 rounded border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300"
        />
      )}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
        Sends nothing by itself — you choose where to share the message.
      </p>
    </div>
  );
}
