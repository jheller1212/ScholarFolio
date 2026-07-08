-- Reference DDL for the profile-corrections feature.
--
-- These objects were applied to the project directly (Supabase SQL editor / MCP),
-- NOT via the migrations CLI. This file is a documentation snapshot so the schema
-- is visible in the repo — running it is not required and it is not picked up by
-- the CLI. Keep it in sync by hand if the objects change (same convention as
-- profile_views.sql).
--
-- What it powers: admin-reviewed corrections applied on top of source-derived
-- profiles at render time (wrong affiliation, stale title, misattributed work).
-- Descriptive fields only — computed metrics are never overridable.

create table if not exists public.profile_overrides (
  id               uuid primary key default gen_random_uuid(),
  author_id        text not null,        -- Scholar id ('NOSPtp8AAAAJ') or 'openalex:A5012349832'
  field            text not null check (field in ('affiliation','title','display_name','hide_work')),
  value            jsonb not null,       -- e.g. "University of Example" (jsonb string) | {"work_url":"…"}
  note             text,                 -- rationale, shown in provenance/audit
  source_report_id uuid references public.profile_reports(id) on delete set null,
  verified_via     text not null default 'admin' check (verified_via in ('admin','orcid')),
  created_by       uuid references auth.users(id) on delete set null,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists profile_overrides_author_idx
  on public.profile_overrides (author_id) where active;

-- Locked down: RLS on, no anon access. Reads for display go through the
-- SECURITY DEFINER function below; writes are admin-only (policies mirror the
-- existing profile_reports admin pattern).
alter table public.profile_overrides enable row level security;

create policy "Admin can view overrides" on public.profile_overrides
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'jonasheller89@gmail.com');

create policy "Admin can insert overrides" on public.profile_overrides
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'jonasheller89@gmail.com');

create policy "Admin can update overrides" on public.profile_overrides
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'jonasheller89@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'jonasheller89@gmail.com');

-- Public/display read: returns only the display-safe columns for active rows,
-- so the browser (anon key) never touches the locked table and created_by /
-- source_report_id are never exposed. search_path pinned against hijacking.
create or replace function public.get_profile_overrides(p_author_id text)
returns table (field text, value jsonb, note text, verified_via text)
language sql
security definer
set search_path = public
as $$
  select field, value, note, verified_via
  from public.profile_overrides
  where author_id = p_author_id and active
$$;

revoke all on function public.get_profile_overrides(text) from public;
grant execute on function public.get_profile_overrides(text) to anon, authenticated, service_role;
