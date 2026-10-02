import { useState } from 'react';
import { AlertCircle, Check, Clock, Loader2 } from 'lucide-react';
import { proposeRecordMerge, type MergeOutcome } from '../../services/corrections/ownerApi';

interface MergeRecordPanelProps {
  onMerged: () => void;
}

/** Pull the A… id out of whatever the owner pasted (bare id, openalex.org URL, API URL). */
export function parseOpenAlexAuthorId(input: string): string | null {
  const m = input.trim().match(/\b(A\d{6,})\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** "This other OpenAlex record is also me." */
export function MergeRecordPanel({ onMerged }: MergeRecordPanelProps) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MergeOutcome | null>(null);

  const submit = async () => {
    const id = parseOpenAlexAuthorId(input);
    if (!id) { setError('Paste an OpenAlex author link or id (it starts with "A").'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await proposeRecordMerge(id);
      setOutcome(r);
      if (r.merged) onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request.');
    } finally {
      setBusy(false);
    }
  };

  if (outcome) {
    return outcome.merged ? (
      <p className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-2">
        <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        {outcome.already ? 'Those records are already merged.' : 'Merged: OpenAlex links that record to your ORCID iD, so OpenAlex-based views of your profile now include its papers.'}
      </p>
    ) : (
      <p className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-2">
        <Clock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
        OpenAlex doesn&rsquo;t link that record to your ORCID iD yet, so we&rsquo;ll check it by hand and merge it once we can confirm it&rsquo;s yours.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        OpenAlex sometimes splits one researcher into several records (a name variant, a move). If you find another
        record with your papers on <a href="https://openalex.org" target="_blank" rel="noopener noreferrer" className="underline">openalex.org</a>,
        paste its link here. We merge it right away when OpenAlex ties it to your ORCID iD; otherwise we review it by hand.
        We never merge on a similar name alone.
      </p>
      <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="https://openalex.org/A5012345678"
        aria-label="Other OpenAlex record"
        className="w-full px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none" />
      {error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
        </div>
      )}
      <button onClick={submit} disabled={busy || !input.trim()}
        className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Checking…</span> : 'This record is also me'}
      </button>
    </div>
  );
}
