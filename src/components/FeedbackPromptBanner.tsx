import { X } from 'lucide-react';

interface FeedbackPromptBannerProps {
  onOpenFeedback: () => void;
  onDismiss: () => void;
  creditsAmount: number;
}

export function FeedbackPromptBanner({ onOpenFeedback, onDismiss, creditsAmount }: FeedbackPromptBannerProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fade-up">
      <div className="relative bg-white dark:bg-slate-800 border border-[#2d7d7d]/20 shadow-lg rounded-xl px-5 py-3 max-w-sm w-[calc(100vw-2rem)]">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 pr-5">
          Enjoying Scholar Folio?
        </p>
        <button
          onClick={onOpenFeedback}
          className="text-sm text-[#2d7d7d] dark:text-[#5bbdbd] hover:underline font-medium mt-0.5"
        >
          Share quick feedback &rarr; earn {creditsAmount} credits
        </button>
      </div>
    </div>
  );
}
