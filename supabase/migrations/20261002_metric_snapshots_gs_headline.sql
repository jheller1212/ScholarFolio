-- Google Scholar headline numbers on monthly snapshots, so the citation digest
-- reports the same numbers the profile headlines show (GS, not OpenAlex).
-- gs_top_works keeps the ~100 most-cited works ({key,title,citations}) for the
-- "most cited this month" line. gs_source records where the numbers came from;
-- the digest only diffs two snapshots from the same source.

ALTER TABLE public.metric_snapshots
  ADD COLUMN IF NOT EXISTS gs_citations integer,
  ADD COLUMN IF NOT EXISTS gs_h_index integer,
  ADD COLUMN IF NOT EXISTS gs_i10_index integer,
  ADD COLUMN IF NOT EXISTS gs_top_works jsonb,
  ADD COLUMN IF NOT EXISTS gs_source text CHECK (gs_source IN ('serpapi', 'cache')),
  ADD COLUMN IF NOT EXISTS gs_fetched_at timestamptz;

CREATE INDEX IF NOT EXISTS sent_emails_kind_sent_at_idx ON public.sent_emails (kind, sent_at);
