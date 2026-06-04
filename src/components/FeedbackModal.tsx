import { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FeedbackModalProps {
  mode: 'prompt' | 'button';
  onClose: () => void;
  onSuccess: (creditsGranted: number) => void;
  profileViewed: string | null;
  isFirstFeedback: boolean;
}

export function FeedbackModal({ mode, onClose, onSuccess, profileViewed, isFirstFeedback }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const creditsAmount = isFirstFeedback ? 5 : 2;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSubmit = async () => {
    if (mode === 'button' && rating === 0) {
      setError('Please select a star rating.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('You must be signed in to submit feedback.');
        setSubmitting(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            rating: mode === 'button' ? rating : null,
            comment: comment.trim() || null,
            profileViewed,
            source: mode,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Submission failed. Please try again.');
      }

      const data = await res.json();
      const granted: number = data?.credits_granted ?? creditsAmount;

      setSuccessMessage(`Thanks! You earned ${granted} credits.`);
      setTimeout(() => {
        onSuccess(granted);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  const headerTitle = mode === 'prompt' ? "How's your experience?" : 'Share Feedback';
  const buttonLabel = successMessage
    ? successMessage
    : submitting
    ? ''
    : mode === 'prompt'
    ? `Share feedback — earn ${creditsAmount} credits`
    : `Submit — earn ${creditsAmount} credits`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#2d7d7d] to-[#1a5c5c] px-6 pt-5 pb-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 id="feedback-modal-title" className="text-lg font-bold pr-8">{headerTitle}</h2>
          {mode === 'prompt' && (
            <p className="text-sm text-white/80 mt-1">
              Earn {creditsAmount} credits for sharing a quick thought.
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Star rating — button mode only */}
          {mode === 'button' && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How would you rate Scholar Folio?
              </p>
              <div
                className="flex gap-1"
                onMouseLeave={() => setHoverRating(0)}
                role="radiogroup"
                aria-label="Star rating"
              >
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    className="text-3xl leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7d7d] rounded"
                    style={{ color: star <= (hoverRating || rating) ? '#f59e0b' : '#d1d5db' }}
                  >
                    &#9733;
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Textarea */}
          <div>
            <label htmlFor="feedback-comment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {mode === 'prompt' ? 'Your feedback' : 'Any additional thoughts? (optional)'}
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={mode === 'prompt' ? 'What do you think of Scholar Folio so far?' : 'Tell us what you think...'}
              rows={3}
              className="w-full px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none transition-colors resize-none"
              maxLength={1000}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !!successMessage}
            className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] shadow-md shadow-[#2d7d7d]/20 hover:shadow-lg hover:shadow-[#2d7d7d]/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </span>
            ) : successMessage ? (
              successMessage
            ) : (
              buttonLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
