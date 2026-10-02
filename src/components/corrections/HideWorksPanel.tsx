import { useMemo, useState } from 'react';
import { AlertCircle, EyeOff, Eye, Loader2, Search } from 'lucide-react';
import { submitOwnerCorrection } from '../../services/corrections/ownerApi';
import { workTitleKey } from '../../services/corrections';

interface HideWorksPanelProps {
  authorId: string;
  /** Titles currently shown on the profile (already excludes hidden ones). */
  visibleTitles: string[];
  /** Titles hidden so far, loaded from the active overrides. */
  initialHidden: string[];
  onChanged: () => void;
}

const MAX_LISTED = 40;

/** Hide papers that aren't yours (and un-hide them). Each click saves at once. */
export function HideWorksPanel({ authorId, visibleTitles, initialHidden, onChanged }: HideWorksPanelProps) {
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hiddenKeys = useMemo(() => new Set(hidden.map(workTitleKey)), [hidden]);
  const candidates = useMemo(() => {
    const q = workTitleKey(query);
    return visibleTitles
      .filter(t => !hiddenKeys.has(workTitleKey(t)))
      .filter(t => !q || workTitleKey(t).includes(q))
      .slice(0, MAX_LISTED);
  }, [visibleTitles, hiddenKeys, query]);

  const toggle = async (title: string, hide: boolean) => {
    setBusy(title);
    setError(null);
    try {
      await submitOwnerCorrection(authorId, 'hide_work', title, !hide);
      setHidden(prev => hide ? [...prev, title] : prev.filter(t => workTitleKey(t) !== workTitleKey(title)));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const row = (title: string, hide: boolean) => (
    <li key={`${hide ? 'v' : 'h'}-${title}`} className="flex items-start justify-between gap-3 py-2">
      <span className="text-xs text-gray-700 dark:text-gray-200 leading-snug">{title}</span>
      <button onClick={() => toggle(title, hide)} disabled={busy !== null}
        className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-[#2d7d7d] dark:text-[#5bbdbd] hover:underline disabled:opacity-50">
        {busy === title ? <Loader2 className="h-3 w-3 animate-spin" /> : hide ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        {hide ? 'Not mine — hide' : 'Show again'}
      </button>
    </li>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Hidden papers disappear from your publication list and the narrative. Headline numbers come from
        Google Scholar — remove the paper there too to change them.
      </p>
      {hidden.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Hidden ({hidden.length})</p>
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">{hidden.map(t => row(t, false))}</ul>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a paper by title"
          aria-label="Find a paper by title"
          className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none" />
      </div>
      <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
        {candidates.map(t => row(t, true))}
        {candidates.length === 0 && <li className="py-2 text-xs text-gray-400">No matching papers.</li>}
      </ul>
      {error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
        </div>
      )}
    </div>
  );
}
