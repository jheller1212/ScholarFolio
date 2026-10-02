import { useState } from 'react';
import { ExternalLink, Flag, Send } from 'lucide-react';
import { OVERDUE_DAYS, daysWaiting, triageOrder } from '../../utils/reportTriage';
import { ReportResolveForm } from './ReportResolveForm';

export interface ProfileReport {
  id: string;
  author_id: string;
  author_name: string | null;
  reporter_email: string | null;
  message: string;
  page_url: string | null;
  created_at: string;
  resolved: boolean;
  resolved_note: string | null;
  notified_at?: string | null;
  reporter_feedback?: number | null;
}

interface ProfileReportsPanelProps {
  reports: ProfileReport[];
  onReportsChange: (update: (prev: ProfileReport[]) => ProfileReport[]) => void;
  onReply: (report: ProfileReport) => void;
}

const EASE_LABEL: Record<number, string> = { 3: 'easy to report', 2: 'okay to report', 1: 'confusing to report' };

/** Admin list of profile error reports, open ones first. */
export function ProfileReportsPanel({ reports, onReportsChange, onReply }: ProfileReportsPanelProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (reports.length === 0) return null;
  const open = reports.filter(r => !r.resolved).length;

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <Flag className="h-4 w-4 text-red-500" />
        Profile Error Reports ({reports.length})
        {open > 0 && <span className="text-xs font-medium text-red-700 bg-red-50 rounded-full px-2 py-0.5">{open} open</span>}
      </h3>
      <div className="space-y-3">
        {triageOrder(reports).map(report => (
          <div key={report.id} className={`border rounded-xl p-4 ${report.resolved ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium">
                  {report.author_name || report.author_id}
                  {report.resolved && <span className="ml-2 text-xs text-emerald-600 font-normal">resolved{report.notified_at ? ' · reporter emailed' : ''}</span>}
                  {!report.resolved && (
                    <span className={`ml-2 text-xs font-normal ${daysWaiting(report) > OVERDUE_DAYS ? 'text-red-600' : 'text-amber-600'}`}>
                      waiting {daysWaiting(report)} {daysWaiting(report) === 1 ? 'day' : 'days'}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600 mt-1">{report.message}</p>
                {report.resolved_note && <p className="text-xs text-emerald-700 mt-1 italic">Fix: {report.resolved_note}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {report.reporter_email && <span>{report.reporter_email}</span>}
                  {report.reporter_feedback ? <span>{EASE_LABEL[report.reporter_feedback]}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {report.reporter_email && (
                  <button onClick={() => onReply(report)} className="text-xs text-[#2d7d7d] hover:text-[#1f5c5c] flex items-center gap-1" title="Reply via email">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
                {report.page_url && (
                  <a href={report.page_url} target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:text-[#1f5c5c]" title="View profile">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {!report.resolved && (
                  <button onClick={() => setResolvingId(resolvingId === report.id ? null : report.id)} className="text-xs text-gray-500 hover:text-emerald-600 transition-colors">
                    Resolve
                  </button>
                )}
              </div>
            </div>
            {resolvingId === report.id && (
              <ReportResolveForm
                report={report}
                onResolved={(note, notified) => {
                  const notifiedAt = notified ? new Date().toISOString() : report.notified_at ?? null;
                  onReportsChange(prev => prev.map(r => r.id === report.id ? { ...r, resolved: true, resolved_note: note, notified_at: notifiedAt } : r));
                  setResolvingId(null);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
