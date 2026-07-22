-- Thank-you credits for profile error reports.
-- Applied directly to production 2026-07-22.
--
-- Reporting a data error now grants the reporter 3 credits immediately. The
-- grant is made server-side by the `report-profile` edge function (deployed
-- --no-verify-jwt), which needs to know how much a given account has already
-- received so reporting can't be farmed for credits.
--
-- user_id is nullable on purpose: anonymous visitors must still be able to
-- report errors — that is how most data-quality bugs reach us — they simply
-- receive no credits.

ALTER TABLE public.profile_reports
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credits_granted integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profile_reports.user_id IS
  'Reporter when signed in; null for anonymous reports. Used to cap the thank-you credit grant.';
COMMENT ON COLUMN public.profile_reports.credits_granted IS
  'Credits granted for this report (0 for anonymous or once the per-user cap is reached).';
