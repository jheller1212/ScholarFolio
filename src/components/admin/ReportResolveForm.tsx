import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { resolveProfileReport } from '../../services/reports';
import type { ProfileReport } from './ProfileReportsPanel';

type CorrectionField = '' | 'affiliation' | 'display_name';

interface ReportResolveFormProps {
  report: ProfileReport;
  onResolved: (note: string | null, notified: boolean) => void;
}

const inputClass = 'px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none';

/**
 * Resolve one report: optionally apply a verified correction, then mark it
 * resolved through resolve-report, which emails the reporter "fixed" when
 * they left an address (and the box stays ticked).
 */
export function ReportResolveForm({ report, onResolved }: ReportResolveFormProps) {
  const [note, setNote] = useState('');
  const [field, setField] = useState<CorrectionField>('');
  const [value, setValue] = useState('');
  const [notify, setNotify] = useState(Boolean(report.reporter_email));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (field && value.trim()) {
        const { error: ovErr } = await supabase.from('profile_overrides').insert({
          author_id: report.author_id,
          field,
          value: value.trim(),
          note: note || null,
          source_report_id: report.id,
          verified_via: 'admin',
        });
        if (ovErr) throw new Error(`Could not apply correction: ${ovErr.message}`);
      }
      const { notified } = await resolveProfileReport(report.id, note.trim() || null, notify);
      onResolved(note.trim() || null, notified);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve the report.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="What was fixed? (shown in the email)" className={inputClass} />
      {/* Optional: apply a verified correction that overrides the source data on the live profile */}
      <div className="flex gap-2">
        <select value={field} onChange={e => setField(e.target.value as CorrectionField)} className={`${inputClass} bg-white`}>
          <option value="">No correction — just resolve</option>
          <option value="affiliation">Correct affiliation</option>
          <option value="display_name">Correct display name</option>
        </select>
        {field && (
          <input type="text" value={value} onChange={e => setValue(e.target.value)}
            placeholder={field === 'affiliation' ? 'Corrected affiliation' : 'Corrected name'} className={`flex-1 ${inputClass}`} />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        {report.reporter_email ? (
          <label className="text-[11px] text-gray-500 inline-flex items-center gap-1.5">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
            Email {report.reporter_email} that it&rsquo;s fixed
          </label>
        ) : (
          <span className="text-[11px] text-gray-400">No reporter email — nobody to notify.</span>
        )}
        <button
          disabled={saving || (!!field && !value.trim())}
          onClick={submit}
          className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {saving ? 'Saving…' : field ? 'Apply & resolve' : 'Resolve'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
