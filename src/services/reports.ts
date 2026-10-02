import { supabase } from '../lib/supabase';

/** Calls to the report-profile / resolve-report edge functions. */

async function post(fn: string, payload: Record<string, unknown>, fallbackError: string): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : fallbackError);
  return body;
}

export interface ReportInput {
  authorId: string;
  authorName: string;
  message: string;
  reporterEmail: string | null;
  pageUrl: string;
}

export async function submitProfileReport(input: ReportInput): Promise<{ reportId: string | null; willNotify: boolean }> {
  const body = await post('report-profile', { ...input }, 'Could not send your report.');
  return {
    reportId: typeof body.reportId === 'string' ? body.reportId : null,
    willNotify: Boolean(body.willNotify),
  };
}

/** 3 = easy, 2 = okay, 1 = confusing. */
export type ReportEaseRating = 1 | 2 | 3;

export async function sendReportFeedback(reportId: string, rating: ReportEaseRating): Promise<void> {
  await post('report-profile', { action: 'feedback', reportId, rating }, 'Could not save feedback.');
}

/** Admin: resolve a report; emails the reporter "fixed" when they left an address. */
export async function resolveProfileReport(reportId: string, note: string | null, notify: boolean): Promise<{ notified: boolean }> {
  const body = await post('resolve-report', { reportId, note, notify }, 'Could not resolve the report.');
  return { notified: Boolean(body.notified) };
}
