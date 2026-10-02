import { useState } from 'react';
import { Check } from 'lucide-react';
import { sendReportFeedback, type ReportEaseRating } from '../../services/reports';

interface ReportThanksProps {
  reportId: string | null;
  willNotify: boolean;
  onClose: () => void;
}

const OPTIONS: Array<{ rating: ReportEaseRating; label: string }> = [
  { rating: 3, label: 'Easy' },
  { rating: 2, label: 'Okay' },
  { rating: 1, label: 'Confusing' },
];

/** Thank-you after a report, plus one optional question about the flow itself. */
export function ReportThanks({ reportId, willNotify, onClose }: ReportThanksProps) {
  const [answered, setAnswered] = useState(false);

  const answer = (rating: ReportEaseRating) => {
    setAnswered(true);
    // Best-effort: the report is what matters, a lost answer is fine.
    if (reportId) sendReportFeedback(reportId, rating).catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p>
            <strong className="text-gray-900 dark:text-gray-100">Thank you.</strong>{' '}
            Wrong data on a profile is genuinely annoying, and reports like yours are how we find and fix it.
          </p>
          <p>
            {willNotify
              ? "We'll email you as soon as it's fixed."
              : 'We review every report. Leave an email next time and we will tell you when it is fixed.'}
          </p>
        </div>
      </div>

      {reportId && (
        <div className="ml-6 text-xs text-gray-600 dark:text-gray-400">
          {answered ? (
            <p>Thanks for the feedback.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span>How easy was it to report this?</span>
              {OPTIONS.map(o => (
                <button key={o.rating} onClick={() => answer(o.rating)}
                  className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-slate-600 hover:border-[#2d7d7d] hover:text-[#2d7d7d] transition-colors">
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={onClose}
        className="ml-6 px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg transition-colors">
        Close
      </button>
    </div>
  );
}
