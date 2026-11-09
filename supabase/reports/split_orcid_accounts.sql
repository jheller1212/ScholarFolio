-- Likely split accounts: an ORCID placeholder account (<digits>@orcid.scholarfolio.org)
-- that is probably the same person as an email/Google account.
--
-- Before the "link ORCID to the signed-in account" fix, a signed-in user who
-- clicked "Connect your ORCID iD" was switched into a NEW placeholder account.
-- Their real email and digest opt-in stayed on the old account.
--
-- READ-ONLY. Run it in the Supabase SQL editor; it changes nothing. Merge each
-- pair by hand after checking it: usually move app_metadata.orcid_id (and any
-- claimed_profiles row) to the email account, then delete the placeholder.
-- A shared name is a hint, not proof.

with accounts as (
  select
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.email like '%@orcid.scholarfolio.org' as is_placeholder,
    u.raw_app_meta_data ->> 'orcid_id' as orcid_id,
    coalesce(cp.display_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name') as display_name,
    nullif(lower(trim(coalesce(
      cp.display_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'
    ))), '') as name_key,
    cp.slug as claimed_slug,
    cp.verified as claim_verified,
    coalesce(ep.digest_opt_in, false) as digest_opt_in
  from auth.users u
  left join public.claimed_profiles cp on cp.user_id = u.id
  left join public.email_preferences ep on ep.user_id = u.id
),
pairs as (
  select
    p, e,
    abs(extract(epoch from (p.created_at - e.created_at))) <= 1800 as close_in_time,
    coalesce(p.name_key = e.name_key, false) as same_name,
    round(extract(epoch from (p.created_at - e.created_at)) / 60.0) as minutes_after
  from accounts p
  join accounts e on not e.is_placeholder
  where p.is_placeholder
)
select
  case
    when close_in_time and same_name then 'time+name'
    when same_name then 'name'
    else 'time'
  end as match_reason,
  minutes_after as placeholder_minutes_after_email_account,
  (p).id as placeholder_user_id,
  (p).orcid_id as placeholder_orcid,
  (p).display_name as placeholder_name,
  (p).created_at as placeholder_created,
  (p).last_sign_in_at as placeholder_last_sign_in,
  (p).claimed_slug as placeholder_claim,
  (p).claim_verified as placeholder_claim_verified,
  (p).digest_opt_in as placeholder_digest,
  (e).id as email_user_id,
  (e).email as email_account,
  (e).orcid_id as email_account_orcid,
  (e).display_name as email_name,
  (e).created_at as email_created,
  (e).last_sign_in_at as email_last_sign_in,
  (e).claimed_slug as email_claim,
  (e).digest_opt_in as email_digest
from pairs
where close_in_time or same_name
order by same_name desc, close_in_time desc, (p).created_at desc;
