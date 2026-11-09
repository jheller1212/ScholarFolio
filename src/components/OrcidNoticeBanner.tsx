import { X } from 'lucide-react';
import type { OrcidNotice } from '../lib/orcidReturn';

interface OrcidNoticeBannerProps {
  notice: OrcidNotice;
  onDismiss: () => void;
}

export function OrcidNoticeBanner({ notice, onDismiss }: OrcidNoticeBannerProps) {
  const tone = notice.tone === 'success'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-100'
    : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-100';
  return (
    <div role="status" className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 border px-4 py-3 rounded-xl shadow-lg max-w-md w-[calc(100%-2rem)] text-sm ${tone}`}>
      <p className="flex-1">{notice.text}</p>
      <button onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
