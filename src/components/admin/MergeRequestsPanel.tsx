import { useEffect, useState } from 'react';
import { ExternalLink, GitMerge, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { approveRecordMerge } from '../../services/corrections/ownerApi';

interface MergeRequest {
  id: string;
  author_name: string | null;
  reporter_email: string | null;
  message: string;
  created_at: string;
  payload: { alias_id?: string; canonical_id?: string | null; conflict?: string | null } | null;
}

/**
 * Pending "this other OpenAlex record is also me" requests that OpenAlex could
 * not confirm via the owner's ORCID. Approving inserts an author_aliases row
 * with source 'admin' — check both records' papers before you do.
 */
export function MergeRequestsPanel() {
  const [requests, setRequests] = useState<MergeRequest[]>([]);
  const [canonical, setCanonical] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('profile_reports')
      .select('id, author_name, reporter_email, message, created_at, payload')
      .eq('kind', 'merge_request').eq('resolved', false)
      .order('created_at', { ascending: true })
      .then(({ data }) => setRequests((data ?? []) as MergeRequest[]));
  }, []);

  const approve = async (r: MergeRequest) => {
    const aliasId = r.payload?.alias_id ?? '';
    const canonicalId = (canonical[r.id] ?? r.payload?.canonical_id ?? '').trim();
    setBusy(r.id);
    setError(null);
    try {
      await approveRecordMerge(r.id, aliasId, canonicalId);
      setRequests(prev => prev.filter(x => x.id !== r.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setBusy(null);
    }
  };

  const decline = async (r: MergeRequest) => {
    setBusy(r.id);
    await supabase.from('profile_reports').update({ resolved: true, resolved_note: 'Merge declined' }).eq('id', r.id);
    setRequests(prev => prev.filter(x => x.id !== r.id));
    setBusy(null);
  };

  if (requests.length === 0) return null;

  const oaLink = (id: string) => (
    <a href={`https://openalex.org/${id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#2d7d7d] hover:underline">
      {id}<ExternalLink className="h-3 w-3" />
    </a>
  );

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-card p-5">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <GitMerge className="h-4 w-4 text-[#2d7d7d]" />
        Record merge requests ({requests.length})
      </h3>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <div className="space-y-3">
        {requests.map(r => (
          <div key={r.id} className="border border-gray-100 rounded-xl p-4 text-sm">
            <p className="font-medium text-gray-900">{r.author_name ?? 'Verified owner'} <span className="text-xs text-gray-400 font-normal">{r.reporter_email}</span></p>
            <p className="text-xs text-gray-600 mt-1">
              Alias {r.payload?.alias_id ? oaLink(r.payload.alias_id) : '—'}
              {r.payload?.conflict && <span className="text-red-600"> · already merged into {oaLink(r.payload.conflict)}</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input
                type="text"
                value={canonical[r.id] ?? r.payload?.canonical_id ?? ''}
                onChange={e => setCanonical(prev => ({ ...prev, [r.id]: e.target.value }))}
                placeholder="Canonical record (A…)"
                aria-label="Canonical OpenAlex record"
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none"
              />
              <button onClick={() => approve(r)} disabled={busy !== null}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve merge'}
              </button>
              <button onClick={() => decline(r)} disabled={busy !== null} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
