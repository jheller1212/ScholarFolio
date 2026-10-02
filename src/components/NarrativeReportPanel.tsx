import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { logCaughtError } from '../lib/errorLogger';
import { useAuth } from '../contexts/AuthContext';
import { submitProfileReport } from '../services/reports';
import { ReportThanks } from './report/ReportThanks';

interface NarrativeReportPanelProps {
  authorName: string;
  onClose: () => void;
}

/** Inline "something is wrong with this profile" form shown under the narrative. */
export function NarrativeReportPanel({ authorName, onClose }: NarrativeReportPanelProps) {
  const { user } = useAuth();
  const [reportMsg, setReportMsg] = useState('');
  // Signed-in reporters see their account address prefilled — visible and
  // editable, so whether we write back stays their choice.
  const [reportEmail, setReportEmail] = useState(user?.email ?? '');
  const [sending, setSending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reportId: string | null; willNotify: boolean } | null>(null);

  const scholarId = new URLSearchParams(window.location.search).get('user')
    || window.location.pathname.replace(/^\//, '').replace(/\/$/, '')
    || '';

  const handleReport = async () => {
    if (!reportMsg.trim()) return;
    setSending(true);
    setReportError(null);
    try {
      setResult(await submitProfileReport({
        authorId: scholarId,
        authorName,
        reporterEmail: reportEmail.trim() || null,
        message: reportMsg.trim(),
        pageUrl: window.location.href,
      }));
    } catch (err) {
      logCaughtError(err, 'profile', 'NarrativeReportPanel', 'submit-report');
      setReportError(err instanceof Error ? err.message : 'Could not send your report.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-4 bg-gray-50 dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
      {result ? (
        <ReportThanks reportId={result.reportId} willNotify={result.willNotify} onClose={onClose} />
      ) : (
        <>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">
            Spotted something wrong? Tell us what it should say and we'll look into it. Numbers come from Google Scholar and OpenAlex, so some differences start there.
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
            Most common problems: a co-author who is actually you under another
            spelling (maiden name, umlaut, or extra initials), an open-access
            percentage that looks too low, a wrong affiliation, or missing or
            duplicated publications.
          </p>
          <textarea
            value={reportMsg}
            onChange={e => setReportMsg(e.target.value)}
            placeholder="Describe the error — e.g. 'my top co-author is my own maiden name' or 'most of my papers are open access but it shows 0%'"
            rows={3}
            aria-label="Describe the error"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none resize-none mb-2"
            maxLength={1000}
          />
          <label htmlFor="report-email" className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
            Your email <span className="font-normal text-gray-500 dark:text-gray-400">(optional, so we can tell you when it's fixed)</span>
          </label>
          <input
            id="report-email"
            type="email"
            value={reportEmail}
            onChange={e => setReportEmail(e.target.value)}
            placeholder="you@university.edu"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none mb-2"
          />
          {reportError && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-2">
              {reportError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReport}
              disabled={!reportMsg.trim() || sending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg disabled:opacity-50 transition-colors"
            >
              {sending ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Sending...</span>
              ) : 'Submit report'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
