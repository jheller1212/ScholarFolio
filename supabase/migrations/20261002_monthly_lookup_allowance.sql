-- Monthly lookup allowance (replaces the one-off signup grant and the
-- "1 free credit if you hit zero" monthly top-up).
--
-- Policy (mirrors src/lib/constants.ts — keep the two in sync):
--   * signed-in users get MONTHLY_FREE_LOOKUPS = 20 fresh lookups per calendar
--     month (UTC); unused lookups do not roll over.
--   * credits_remaining now means EXTRA lookups (support packs, feedback and
--     report thank-yous, legacy balances). They never expire and are only
--     spent once the month's allowance is used up.
--   * cached profiles, direct links, vanity URLs and OpenAlex fallbacks never
--     reach decrement_credits, so they stay free (unchanged).
--
-- decrement_credits / refund_credit keep their signatures, so the scholar
-- edge function works unchanged against this schema.

-- 1. Allowance bookkeeping on the existing row.
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS monthly_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_period date NOT NULL
    DEFAULT (date_trunc('month', now() AT TIME ZONE 'utc'))::date;

-- New rows start with no extras; the monthly allowance replaces the signup grant.
ALTER TABLE public.user_credits ALTER COLUMN credits_remaining SET DEFAULT 0;

-- Single SQL-side definition of the allowance size.
CREATE OR REPLACE FUNCTION public.monthly_lookup_allowance()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 20 $$;

-- 2. Signup: create the row with 0 extras (allowance covers new users).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_credits (user_id, credits_remaining, total_purchased)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3. Spend one fresh lookup: monthly allowance first, then extras.
--    Row lock makes check-and-spend atomic under concurrent requests.
CREATE OR REPLACE FUNCTION public.decrement_credits(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_period date := (date_trunc('month', now() AT TIME ZONE 'utc'))::date;
  v_row public.user_credits%ROWTYPE;
BEGIN
  INSERT INTO public.user_credits (user_id, credits_remaining, total_purchased)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

  IF v_row.monthly_period < v_period THEN
    v_row.monthly_used := 0;
  END IF;

  IF v_row.monthly_used < public.monthly_lookup_allowance() THEN
    UPDATE public.user_credits
    SET monthly_used = v_row.monthly_used + 1, monthly_period = v_period
    WHERE user_id = p_user_id;
    RETURN true;
  ELSIF v_row.credits_remaining > 0 THEN
    UPDATE public.user_credits
    SET credits_remaining = credits_remaining - 1,
        monthly_used = v_row.monthly_used, monthly_period = v_period
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- 4. Refund after a failed fetch: give back an allowance lookup this month if
--    one was used, otherwise an extra. (Which bucket the failed spend came from
--    is not recorded; either way the user's available total is restored.)
CREATE OR REPLACE FUNCTION public.refund_credit(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_period date := (date_trunc('month', now() AT TIME ZONE 'utc'))::date;
BEGIN
  UPDATE public.user_credits
  SET monthly_used = monthly_used - 1
  WHERE user_id = p_user_id AND monthly_period = v_period AND monthly_used > 0;
  IF NOT FOUND THEN
    UPDATE public.user_credits
    SET credits_remaining = credits_remaining + 1
    WHERE user_id = p_user_id;
  END IF;
END;
$function$;

-- 5. Read model for the UI: the caller's own allowance, with the month
--    rollover applied virtually (no write on read).
CREATE OR REPLACE FUNCTION public.get_lookup_allowance()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_period date := (date_trunc('month', now() AT TIME ZONE 'utc'))::date;
  v_used integer := 0;
  v_extra integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT CASE WHEN monthly_period < v_period THEN 0 ELSE monthly_used END, credits_remaining
  INTO v_used, v_extra
  FROM public.user_credits WHERE user_id = auth.uid();

  RETURN jsonb_build_object(
    'monthly_allowance', public.monthly_lookup_allowance(),
    'monthly_used', COALESCE(v_used, 0),
    'monthly_remaining', GREATEST(public.monthly_lookup_allowance() - COALESCE(v_used, 0), 0),
    'extra', COALESCE(v_extra, 0),
    'resets_on', (v_period + interval '1 month')::date
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_lookup_allowance() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_lookup_allowance() TO authenticated;

-- Spending, refunding and granting are server-only (scholar and stripe-webhook
-- edge functions, service role). Before this they were EXECUTE-able by anon
-- with an arbitrary user id, so anyone could mint lookups for any account.
REVOKE ALL ON FUNCTION public.decrement_credits(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_credit(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_credits(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, integer) TO service_role;

-- 6. Retire the old "1 credit when you hit zero" top-up. Kept as a no-op so
--    browsers still running the previous bundle do not error.
CREATE OR REPLACE FUNCTION public.claim_monthly_credit(p_user_id uuid)
RETURNS integer
LANGUAGE sql
AS $$ SELECT 0 $$;
