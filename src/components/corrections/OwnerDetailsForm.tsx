import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { submitOwnerCorrection, type OwnerField } from '../../services/corrections/ownerApi';
import { toPronounChoice, type PronounChoice } from '../../utils/pronouns';

export interface OwnerDetails {
  name: string;
  affiliation: string;
  title?: string;
  pronouns?: string;
}

interface OwnerDetailsFormProps {
  authorId: string;
  current: OwnerDetails;
  onSaved: () => void;
}

const PRONOUN_OPTIONS: Array<{ value: PronounChoice; label: string }> = [
  { value: 'they', label: 'they/them (default)' },
  { value: 'she', label: 'she/her' },
  { value: 'he', label: 'he/him' },
];

const inputClass =
  'w-full px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none transition-colors';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1';

/** Title, affiliation, display name and pronouns. Only changed fields are sent. */
export function OwnerDetailsForm({ authorId, current, onSaved }: OwnerDetailsFormProps) {
  const currentPronoun = toPronounChoice(current.pronouns ?? '') ?? 'they';
  const [title, setTitle] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pronoun, setPronoun] = useState<PronounChoice>(currentPronoun);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const edits: Array<{ field: OwnerField; value: string }> = [];
    if (title.trim()) edits.push({ field: 'title', value: title.trim() });
    if (affiliation.trim()) edits.push({ field: 'affiliation', value: affiliation.trim() });
    if (displayName.trim()) edits.push({ field: 'display_name', value: displayName.trim() });
    if (pronoun !== currentPronoun) edits.push({ field: 'pronouns', value: pronoun });
    if (edits.length === 0) { setError('Change at least one field.'); return; }

    setSaving(true);
    setError(null);
    try {
      for (const e of edits) await submitOwnerCorrection(authorId, e.field, e.value);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="corr-title" className={labelClass}>Title / position</label>
        <input id="corr-title" type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
          placeholder={current.title || 'e.g. Associate Professor of Marketing'} className={inputClass} />
      </div>
      <div>
        <label htmlFor="corr-aff" className={labelClass}>Affiliation</label>
        <input id="corr-aff" type="text" value={affiliation} onChange={e => setAffiliation(e.target.value)} maxLength={300}
          placeholder={current.affiliation || 'e.g. University of …'} className={inputClass} />
        <p className="text-[11px] text-gray-400 mt-1">Currently: {current.affiliation || '—'}</p>
      </div>
      <div>
        <label htmlFor="corr-name" className={labelClass}>Display name</label>
        <input id="corr-name" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={300}
          placeholder={current.name} className={inputClass} />
      </div>
      <div>
        <label htmlFor="corr-pronouns" className={labelClass}>Pronouns in your research narrative</label>
        <select id="corr-pronouns" value={pronoun} onChange={e => setPronoun(e.target.value as PronounChoice)} className={inputClass}>
          {PRONOUN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-[11px] text-gray-400 mt-1">We never guess pronouns from a name; everyone gets they/them until they tell us otherwise.</p>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
        </div>
      )}

      <button onClick={submit} disabled={saving}
        className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] shadow-md shadow-[#2d7d7d]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : 'Save details'}
      </button>
    </div>
  );
}
