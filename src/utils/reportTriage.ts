interface TriageReport {
  created_at: string;
  resolved: boolean;
}

/** A researcher who wrote in about their own profile shouldn't wait longer than this. */
export const OVERDUE_DAYS = 7;

/** Whole days a report has been waiting. */
export function daysWaiting(report: TriageReport, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(report.created_at).getTime()) / 86_400_000));
}

/**
 * Open reports first, longest-waiting on top; resolved ones after, newest first.
 * The list used to be purely newest-first, which let an unanswered report sink
 * below resolved ones and sit unnoticed for weeks.
 */
export function triageOrder<T extends TriageReport>(reports: T[]): T[] {
  const time = (r: T) => new Date(r.created_at).getTime();
  return [...reports].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return a.resolved ? time(b) - time(a) : time(a) - time(b);
  });
}
