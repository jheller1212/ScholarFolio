import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logCaughtError } from '../lib/errorLogger';
import { useAuth } from '../contexts/AuthContext';

interface NarrativeReportPanelProps {
  authorName: string;
  onClose: () => void;
}

/** Inline "something is wrong with this profile" form shown under the narrative. */
export function NarrativeReportPanel({ authorName, onClose }: NarrativeReportPanelProps) {
  const { refreshCredits } = useAuth();
  const [reportMsg, setReportMsg] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<
    { creditsGranted: number; signedIn: boolean; emailLeft: boolean } | null
  >(null);

  const scholarId = new URLSearchParams(window.location.search).get('user')
    || window.location.pathname.replace(/^\//, '').replace(/\/$/, '')
    || '';

  const handleReport = async () => {
    if (!reportMsg.trim()) return;
    setReportStatus('sending');
    setReportError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            authorId: scholarId,
            authorName,
            reporterEmail: reportEmail.trim() || null,
            message: reportMsg.trim(),
            pageUrl: window.location.href,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not send your report.');
      setReportResult({
        creditsGranted: body.creditsGranted ?? 0,
        signedIn: Boolean(body.signedIn),
        emailLeft: Boolean(reportEmail.trim()),
      });
      // Credits land server-side; refresh the header so the new balance shows.
      if (body.creditsGranted > 0) refreshCredits();
      setReportStatus('sent');
    } catch (err) {
      logCaughtError(err, 'profile', 'ResearcherNarrative', 'submit-report');
      setReportError(err instanceof Error ? err.message : 'Could not send your report.');
      setReportStatus('idle');
    }
  };

  const closeReport = onClose; // unmounting resets the form state

  return (
    <div className="mb-4 bg-gray-50 dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
      {reportStatus === 'sent' && reportResult ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p>
                <strong className="text-gray-900 dark:text-gray-100">Sorry about that — and thank you.</strong>{' '}
                Wrong data on your own profile is genuinely annoying, and reports like
                yours are how we find these problems.
              </p>
              {reportResult.creditsGranted > 0 ? (
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                  We've added {reportResult.creditsGranted} free credits to your account right away.
                </p>
              ) : reportResult.signedIn ? (
                <p className="text-gray-500 dark:text-gray-400">
                  You've already received the maximum thank-you credits — the report still helps just as much.
                </p>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  Create a free account and future reports earn you 3 credits each.
                </p>
              )}
              <p>
                {reportResult.emailLeft
                  ? "We'll follow up by email once we've looked into it."
                  : 'We review every report. Next time you can leave an email if you\'d like a reply.'}
              </p>
            </div>
          </div>
          <button
            onClick={closeReport}
            className="ml-6 px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">
            Spotted something wrong? Tell us and we'll fix it —{' '}
            <strong className="text-amber-700 dark:text-amber-400">you'll get 3 credits straight away</strong> as thanks.
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
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none resize-none mb-2"
            maxLength={1000}
          />
          <input
            type="email"
            value={reportEmail}
            onChange={e => setReportEmail(e.target.value)}
            placeholder="Your email (optional — so we can tell you when it's fixed)"
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
              disabled={!reportMsg.trim() || reportStatus === 'sending'}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg disabled:opacity-50 transition-colors"
            >
              {reportStatus === 'sending' ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Sending...</span>
              ) : 'Submit report'}
            </button>
            <button
              onClick={closeReport}
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
