import React, { useState, useCallback, useMemo } from 'react';
import { Search, Loader2, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { OA_API_URL, OA_EMAIL, oaRateLimiter } from '../services/openalex/author-lookup';
import { timeoutSignal } from '../utils/api';
import { logCaughtError } from '../lib/errorLogger';
import { fetchPIndexWorks, computePIndexFromWorks, type PIndexWork, type PIndexResult } from '../services/openalex/pindex';
import { MetricsCard } from './MetricsCard';

interface OpenAlexSearchResult {
  id: string;
  display_name: string;
  works_count: number;
  cited_by_count: number;
  last_known_institutions?: Array<{ display_name?: string }>;
}

interface PIndexSectionProps {
  authorName: string;
  affiliation: string;
  onResult?: (result: PIndexResult | null) => void;
  scrapedPublications?: Array<{ title: string; year: number; citations: number }>;
}

type Step = 'idle' | 'searching' | 'select' | 'loading-works' | 'review' | 'computing' | 'done' | 'error';
type MatchStatus = 'confirmed' | 'likely' | 'unmatched';

function titleSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / Math.max(wordsA.size, wordsB.size);
}

export function PIndexSection({ authorName, affiliation, onResult, scrapedPublications }: PIndexSectionProps) {
  const [step, setStep] = useState<Step>('idle');
  const [searchResults, setSearchResults] = useState<OpenAlexSearchResult[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<OpenAlexSearchResult | null>(null);
  const [allWorks, setAllWorks] = useState<PIndexWork[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<PIndexResult | null>(null);
  const [progress, setProgress] = useState({ pct: 0, status: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [matchStatuses, setMatchStatuses] = useState<Map<string, MatchStatus>>(new Map());
  const [reviewTab, setReviewTab] = useState<'review' | 'confirmed'>('review');

  const [firstName, setFirstName] = useState(() => {
    const parts = authorName.trim().split(/\s+/);
    if (parts.length <= 1) return '';
    // Find where surname starts: detect surname prefixes (van, de, von, etc.)
    const prefixes = new Set(['de', 'van', 'von', 'di', 'da', 'del', 'della', 'la', 'le', 'el', 'al', 'bin', 'ben', 'ter', 'ten', 'den', 'der']);
    let surnameStart = parts.length - 1;
    for (let i = parts.length - 2; i >= 1; i--) {
      if (prefixes.has(parts[i].toLowerCase())) surnameStart = i;
      else break;
    }
    return parts.slice(0, surnameStart).join(' ');
  });
  const [lastName, setLastName] = useState(() => {
    const parts = authorName.trim().split(/\s+/);
    if (parts.length <= 1) return authorName;
    const prefixes = new Set(['de', 'van', 'von', 'di', 'da', 'del', 'della', 'la', 'le', 'el', 'al', 'bin', 'ben', 'ter', 'ten', 'den', 'der']);
    let surnameStart = parts.length - 1;
    for (let i = parts.length - 2; i >= 1; i--) {
      if (prefixes.has(parts[i].toLowerCase())) surnameStart = i;
      else break;
    }
    return parts.slice(surnameStart).join(' ');
  });
  const [institution, setInstitution] = useState(() => {
    // Strip academic titles like "Full Professor, " or "Associate Professor of Marketing, "
    let cleaned = affiliation
      .replace(/^(Distinguished|Emeritus|Adjunct|Visiting|Clinical|Tenured|Senior|Junior|Assistant|Associate|Full)?\s*(Professor|Lecturer|Researcher|Fellow|Instructor|Reader|Chair|Director|Dean)\s*(of\s+\w[\w\s]*?)?\s*[,·]\s*/i, '')
      .trim();
    if (cleaned === affiliation) cleaned = affiliation;
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
    // Skip "Department of X" / "School of X" / "Faculty of X" parts — prefer the university name
    const inst = parts.find(p => !/^(Department|School|Faculty|Division|Institute|Center|Centre|College)\s+(of|for)\s+/i.test(p)) || parts[0] || affiliation;
    return inst;
  });

  const includedCount = useMemo(() => allWorks.length - excludedIds.size, [allWorks, excludedIds]);

  const matchSummary = useMemo(() => {
    if (matchStatuses.size === 0) return null;
    let confirmed = 0, likely = 0, unmatched = 0;
    for (const status of matchStatuses.values()) {
      if (status === 'confirmed') confirmed++;
      else if (status === 'likely') likely++;
      else unmatched++;
    }
    return { confirmed, likely, unmatched };
  }, [matchStatuses]);

  const sortedWorks = useMemo(() => {
    if (matchStatuses.size === 0) return allWorks;
    const order: Record<MatchStatus, number> = { likely: 0, unmatched: 1, confirmed: 2 };
    return [...allWorks].sort((a, b) => {
      const statusA = matchStatuses.get(a.id) ?? 'unmatched';
      const statusB = matchStatuses.get(b.id) ?? 'unmatched';
      if (order[statusA] !== order[statusB]) return order[statusA] - order[statusB];
      return b.year - a.year || b.citations - a.citations;
    });
  }, [allWorks, matchStatuses]);

  const filteredWorks = useMemo(() => {
    if (matchStatuses.size === 0) return sortedWorks;
    if (reviewTab === 'confirmed') {
      return sortedWorks.filter(w => matchStatuses.get(w.id) === 'confirmed');
    }
    return sortedWorks.filter(w => matchStatuses.get(w.id) !== 'confirmed');
  }, [sortedWorks, matchStatuses, reviewTab]);

  const reviewTabCounts = useMemo(() => {
    if (matchStatuses.size === 0) return null;
    let needsReview = 0, confirmed = 0;
    for (const status of matchStatuses.values()) {
      if (status === 'confirmed') confirmed++;
      else needsReview++;
    }
    return { needsReview, confirmed };
  }, [matchStatuses]);

  const handleSearch = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setStep('searching');
    setErrorMsg('');

    try {
      const query = `${firstName} ${lastName}`;
      const url = `${OA_API_URL}/authors?search=${encodeURIComponent(query)}&per_page=10&select=id,display_name,works_count,cited_by_count,last_known_institutions&mailto=${OA_EMAIL}`;
      // Direct fetch — bypass the shared rate limiter to avoid queuing behind OA stats
      // Don't send OA_HEADERS (custom User-Agent is a forbidden header on Firefox/mobile)
      // The mailto= param in the URL is sufficient for OpenAlex polite pool
      const response = await fetch(url, { signal: timeoutSignal(15000) });
      if (!response.ok) {
        setErrorMsg(`Could not reach OpenAlex (HTTP ${response.status}). Please wait a moment and try again. (SF-PI-SEARCH)`);
        setStep('error');
        return;
      }
      const data: { results: OpenAlexSearchResult[] } = await response.json();

      if (!data.results?.length) {
        setErrorMsg('No authors found in OpenAlex. Try adjusting the name. (SF-PI-NORESULT)');
        setStep('error');
        return;
      }

      setSearchResults(data.results);
      setStep('select');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logCaughtError(err, 'pindex', 'PIndexSection', 'search', { firstName, lastName, institution });
      setErrorMsg(`Could not reach OpenAlex: ${msg} (SF-PI-NET)`);
      setStep('error');
    }
  }, [firstName, lastName, institution]);

  const handleSelectAuthor = useCallback(async (author: OpenAlexSearchResult) => {
    setSelectedAuthor(author);
    setStep('loading-works');

    try {
      const works = await fetchPIndexWorks(author.id);
      if (works.length === 0) {
        setErrorMsg(`No publications found for ${author.display_name} in OpenAlex. (SF-PI-NOPUBS)`);
        setStep('error');
        return;
      }

      // Sort by year desc, then citations desc as baseline
      works.sort((a, b) => b.year - a.year || b.citations - a.citations);
      setAllWorks(works);

      // Compute match status against scraped Google Scholar publications
      if (scrapedPublications && scrapedPublications.length > 0) {
        const statuses = new Map<string, MatchStatus>();
        for (const work of works) {
          let bestScore = 0;
          for (const scraped of scrapedPublications) {
            const score = titleSimilarity(work.title, scraped.title);
            if (score > bestScore) bestScore = score;
          }
          if (bestScore >= 0.8) statuses.set(work.id, 'confirmed');
          else if (bestScore >= 0.5) statuses.set(work.id, 'likely');
          else statuses.set(work.id, 'unmatched');
        }
        setMatchStatuses(statuses);

        // Only auto-exclude works with zero word overlap (clearly not the same author's work).
        // "Likely" and borderline "unmatched" works stay checked — user can deselect manually.
        const autoExcluded = new Set(
          works.filter(w => statuses.get(w.id) === 'unmatched').map(w => w.id)
        );
        setExcludedIds(autoExcluded);
      } else {
        setMatchStatuses(new Map());
        setExcludedIds(new Set());
      }

      setStep('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logCaughtError(err, 'pindex', 'PIndexSection', 'fetch-works', { authorId: author.id, authorName: author.display_name });
      setErrorMsg(`Failed to fetch publications: ${msg} (SF-PI-WORKS)`);
      setStep('error');
    }
  }, [scrapedPublications]);

  const toggleWork = useCallback((id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setExcludedIds(new Set());
  }, []);

  const handleDeselectAll = useCallback(() => {
    setExcludedIds(new Set(allWorks.map(w => w.id)));
  }, [allWorks]);

  const handleCompute = useCallback(async () => {
    if (!selectedAuthor) return;
    const included = allWorks.filter(w => !excludedIds.has(w.id));
    if (included.length === 0) {
      setErrorMsg('Select at least one publication to compute the p-index.');
      setStep('error');
      return;
    }

    setResult(null);
    onResult?.(null);
    setStep('computing');
    setProgress({ pct: 0, status: 'Starting…' });

    try {
      const pIndex = await computePIndexFromWorks(included, selectedAuthor.id, (pct, status) => {
        setProgress({ pct, status });
      });

      if (pIndex) {
        setResult(pIndex);
        onResult?.(pIndex);
        setStep('done');
      } else {
        setErrorMsg('Could not compute p-index. No publications with journal data found. (SF-PI-NOJOURNAL)');
        setStep('error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logCaughtError(err, 'pindex', 'PIndexSection', 'compute', { authorId: selectedAuthor?.id, includedCount: included.length });
      setErrorMsg(`Calculation failed: ${msg} (SF-PI-CALC)`);
      setStep('error');
    }
  }, [selectedAuthor, allWorks, excludedIds, onResult]);

  const handleReset = useCallback(() => {
    setStep('idle');
    setResult(null);
    setSelectedAuthor(null);
    setSearchResults([]);
    setAllWorks([]);
    setExcludedIds(new Set());
    setMatchStatuses(new Map());
    setReviewTab('review');
    setErrorMsg('');
    setProgress({ pct: 0, status: '' });
    oaRateLimiter.clear();
  }, []);

  const handleBackToReview = useCallback(() => {
    setStep('review');
    setResult(null);
  }, []);

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
        P-Index
        <a href="https://academic.oup.com/jcr/article-abstract/51/1/191/7672992" target="_blank" rel="noopener noreferrer" className="text-[10px] font-normal text-gray-400 dark:text-gray-500 hover:text-[#2d7d7d] transition-colors">(Pham, Wu &amp; Wang, 2024)</a>
      </h3>

      {/* Step 1: Idle — info + search form */}
      {step === 'idle' && (
        <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl p-4 mb-3">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-violet-700 dark:text-violet-300 space-y-2">
              <p>
                The <strong>p-index</strong> measures where your papers rank in citation percentile
                <em> within their own journal and publication year</em>. It indicates thought leadership
                independent of field or career stage.
              </p>
              <p className="text-violet-500 dark:text-violet-400">
                This uses OpenAlex data, which may differ from Google Scholar or Web of Science.
                Calculation takes 10–30 seconds as it analyzes citation distributions for each journal-year.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-medium text-violet-600 dark:text-violet-400">Confirm your details to calculate:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                className="px-3 py-1.5 text-xs rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                className="px-3 py-1.5 text-xs rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <input
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="Institution"
                className="px-3 py-1.5 text-xs rounded-lg border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!firstName.trim() || !lastName.trim()}
              className="mt-1 flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Search className="h-3 w-3" />
              Find Author in OpenAlex
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Searching */}
      {step === 'searching' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
          Searching OpenAlex…
        </div>
      )}

      {/* Step 3: Author selection */}
      {step === 'select' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select your profile from OpenAlex:
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {searchResults.map(author => {
              const inst = author.last_known_institutions?.[0]?.display_name || 'Unknown institution';
              return (
                <button
                  key={author.id}
                  onClick={() => handleSelectAuthor(author)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 border border-transparent hover:border-violet-200 dark:hover:border-violet-800 transition-colors"
                >
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{author.display_name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {inst} · {author.works_count} works · {author.cited_by_count.toLocaleString()} citations
                  </p>
                </button>
              );
            })}
          </div>
          <button onClick={handleReset} className="mt-3 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ← Back to search
          </button>
        </div>
      )}

      {/* Step 3b: Loading publications */}
      {step === 'loading-works' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
          Loading publications for {selectedAuthor?.display_name}…
        </div>
      )}

      {/* Step 4: Review & filter publications */}
      {step === 'review' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Review publications for <strong>{selectedAuthor?.display_name}</strong>
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {includedCount} of {allWorks.length} selected.
                {matchSummary && (
                  <span className="ml-1">
                    {matchSummary.likely} possible · {matchSummary.unmatched} unmatched · {matchSummary.confirmed} confirmed
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="text-[10px] text-violet-600 dark:text-violet-400 hover:underline"
              >
                Select all
              </button>
              <span className="text-[10px] text-gray-300 dark:text-gray-600">|</span>
              <button
                onClick={handleDeselectAll}
                className="text-[10px] text-violet-600 dark:text-violet-400 hover:underline"
              >
                Deselect all
              </button>
            </div>
          </div>

          {matchStatuses.size > 0 && reviewTabCounts ? (
            <>
              <div className="flex gap-1 mb-3 border-b border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => setReviewTab('review')}
                  className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
                    reviewTab === 'review'
                      ? 'border-violet-500 text-violet-700 dark:text-violet-300'
                      : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  Needs Review ({reviewTabCounts.needsReview})
                </button>
                <button
                  onClick={() => setReviewTab('confirmed')}
                  className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
                    reviewTab === 'confirmed'
                      ? 'border-green-500 text-green-700 dark:text-green-300'
                      : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  Confirmed ({reviewTabCounts.confirmed})
                </button>
              </div>
              {reviewTab === 'review' ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                  Check any publications below that are yours. Unchecked items will be excluded from the p-index.
                </p>
              ) : (
                <p className="text-[11px] text-green-600 dark:text-green-400 mb-2">
                  These publications matched your Google Scholar profile and are included automatically.
                </p>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                <strong>Important:</strong> Please carefully review and uncheck any publications that are not yours.
                OpenAlex may include papers from other researchers with similar names. Including wrong publications
                will significantly affect your p-index score.
              </p>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto border border-gray-100 dark:border-slate-700 rounded-lg divide-y divide-gray-50 dark:divide-slate-700/50">
            {filteredWorks.map(work => {
              const excluded = excludedIds.has(work.id);
              const matchStatus = matchStatuses.get(work.id);
              return (
                <label
                  key={work.id}
                  className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${excluded ? 'opacity-40' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={!excluded}
                    onChange={() => toggleWork(work.id)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <p className={`text-[11px] leading-tight ${excluded ? 'text-gray-400 dark:text-gray-600 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                        {work.title}
                      </p>
                      {matchStatuses.size > 0 && (
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          matchStatus === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          matchStatus === 'likely' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                          'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
                        }`}>
                          {matchStatus === 'confirmed' ? '✓ GScholar' :
                           matchStatus === 'likely' ? '~ Possible' : '? Not found'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {work.journal} · {work.year} · {work.citations} cit · pos {work.authorPosition}/{work.totalAuthors}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3">
            <button onClick={handleReset} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              ← Back to search
            </button>
            <button
              onClick={handleCompute}
              disabled={includedCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Calculate P-Index ({includedCount} publications)
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Computing with progress */}
      {step === 'computing' && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              Computing p-index for <strong>{selectedAuthor?.display_name}</strong>…
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 mb-1.5">
            <div
              className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400">{progress.status}</p>
        </div>
      )}

      {/* Error state */}
      {step === 'error' && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-700 dark:text-red-300">{errorMsg}</span>
          </div>
          <button onClick={handleReset} className="mt-2 text-[10px] text-red-500 hover:text-red-700 dark:hover:text-red-400">
            Try again
          </button>
        </div>
      )}

      {/* Step 6: Results */}
      {step === 'done' && result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-3">
            <MetricsCard
              title="P-Index (PI)"
              value={result.rawPIndex ?? 0}
              subtitle={
                result.rawPIndex !== null
                  ? result.rawPIndex >= 75 ? 'Excellent' : result.rawPIndex >= 60 ? 'Strong' : result.rawPIndex >= 50 ? 'Above average' : 'Average'
                  : undefined
              }
              icon="pindex"
            />
            <MetricsCard
              title="P-Index (OWPI)"
              value={result.owpiPIndex ?? 0}
              subtitle="Authorship-weighted"
              icon="owpi"
            />
            <MetricsCard
              title="Weighted Citations"
              value={result.weightedCitations.toLocaleString()}
              subtitle="Authorship-adjusted"
              icon="weightedCitations"
            />
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">
            Based on {result.worksWithPercentile} of {result.worksAnalyzed} selected publications from OpenAlex.
            Values may differ from Web of Science due to different coverage and indexing.
            <button onClick={handleBackToReview} className="ml-2 text-violet-500 hover:text-violet-700 underline">
              Edit selection
            </button>
            <span className="mx-1">·</span>
            <button onClick={handleReset} className="text-violet-500 hover:text-violet-700 underline">
              Start over
            </button>
          </p>

          {result.topPublications.length > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-[11px] text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 mb-2"
            >
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showDetails ? 'Hide' : 'Show'} top publications by percentile
            </button>
          )}

          {showDetails && (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-3 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-1.5 pr-3 font-medium">Pctl</th>
                    <th className="text-left py-1.5 pr-3 font-medium">Cit</th>
                    <th className="text-left py-1.5 pr-3 font-medium">Pos</th>
                    <th className="text-left py-1.5 pr-3 font-medium">Journal</th>
                    <th className="text-left py-1.5 font-medium">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {result.topPublications.map((pub, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                      <td className="py-1.5 pr-3 font-mono font-medium text-violet-600 dark:text-violet-400">
                        {pub.percentileRank.toFixed(1)}%
                      </td>
                      <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{pub.citations}</td>
                      <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-500">
                        {pub.authorPosition}/{pub.totalAuthors}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-500 max-w-[150px] truncate">
                        {pub.journal}
                      </td>
                      <td className="py-1.5 text-gray-700 dark:text-gray-300 max-w-[250px] truncate">
                        {pub.title}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedAuthor && (
            <div className="flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400 mt-2">
              <CheckCircle className="h-3 w-3" />
              OpenAlex profile: {selectedAuthor.display_name}
            </div>
          )}
        </>
      )}
    </div>
  );
}
