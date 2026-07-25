-- Monthly metric snapshots — the history a "your citations changed this month"
-- digest diffs against. Sourced from OpenAlex (free, exact via a verified
-- profile's ORCID). One row per profile per calendar month.
-- Applied directly to production 2026-07-25; July baseline captured for the
-- two ORCID-verified profiles.

CREATE TABLE IF NOT EXISTS public.metric_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id text NOT NULL,                 -- Google Scholar id (= claimed_profiles.author_id)
  openalex_author_id text,
  captured_month date NOT NULL,            -- first of the month, for one-per-month uniqueness
  cited_by_count integer,
  works_count integer,
  h_index integer,
  i10_index integer,
  source text NOT NULL DEFAULT 'openalex',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id, captured_month)
);

ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role writes (snapshot job, bypasses RLS); admin reads. No public
-- access — these are per-scholar metrics tied to a claimed profile.
CREATE POLICY "Admin reads metric snapshots" ON public.metric_snapshots
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonasheller89@gmail.com');
