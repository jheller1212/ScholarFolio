-- Reference DDL snapshot for claimed_profiles (applied via SQL, not the CLI).
-- Documents the ORCID-verification columns added for ORCID-controlled claiming.
-- See supabase/functions/claim-profile/ for the verification logic.

-- Columns added 2026-07-08 for ORCID-verified claiming (additive, nullable/defaulted):
alter table public.claimed_profiles
  add column if not exists verified boolean not null default false,  -- true once ORCID-verified
  add column if not exists orcid text,                                -- the verifying ORCID iD (URL form)
  add column if not exists verified_via text;                         -- 'orcid' | 'admin'

-- SECURITY FOLLOW-UP (not yet applied — do this when the ORCID claim flow ships,
-- so the current claim path isn't broken in the meantime):
-- The existing INSERT policy allows any signed-in user to claim any author_id:
--     "Users can claim profiles"  INSERT  with check (auth.uid() = user_id)
-- Once claiming goes exclusively through the claim-profile edge function (which
-- writes with the service role after ORCID verification), drop that policy so the
-- client can no longer insert unverified claims directly:
--   drop policy "Users can claim profiles" on public.claimed_profiles;
--   drop policy "Users can update own claims" on public.claimed_profiles;  -- if edits also move server-side
