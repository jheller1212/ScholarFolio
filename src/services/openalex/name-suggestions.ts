import { oaFetchJson, OA_API_URL } from './author-lookup';
import { rankNameSuggestions, suggestionQueries, type NameSuggestion } from '../../lib/nameSuggestions';

interface OaAutocompleteResult {
  id?: string;
  display_name?: string;
  hint?: string | null;
  cited_by_count?: number;
}

/**
 * Raw OpenAlex author autocomplete for one query, via the scholar proxy (free:
 * no SerpAPI call and no profile lookup is spent). Returns [] on any failure so
 * suggestions can never break a search.
 */
export async function fetchAuthorAutocomplete(query: string, signal?: AbortSignal): Promise<NameSuggestion[]> {
  const data = await oaFetchJson<{ results?: OaAutocompleteResult[] }>(
    `${OA_API_URL}/autocomplete/authors?q=${encodeURIComponent(query.trim())}`,
    8000,
    signal,
  );
  return (data?.results ?? [])
    .filter((r): r is OaAutocompleteResult & { id: string; display_name: string } => !!r.id && !!r.display_name)
    .map(r => ({
      id: r.id.replace('https://openalex.org/', ''),
      name: r.display_name,
      institution: r.hint || '',
      citedBy: r.cited_by_count ?? 0,
    }));
}

/** "Did you mean" candidates for a name that found nobody on Google Scholar. */
export async function fetchNameSuggestions(query: string, signal?: AbortSignal, limit = 5): Promise<NameSuggestion[]> {
  const batches = await Promise.all(suggestionQueries(query).map(q => fetchAuthorAutocomplete(q, signal)));
  return rankNameSuggestions(query, batches.flat(), limit);
}
