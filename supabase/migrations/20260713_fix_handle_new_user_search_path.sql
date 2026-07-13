-- Fix: signup credit grant silently broken since ~2026-07-02.
--
-- handle_new_user() was recreated (adding ON CONFLICT + exception handler)
-- without SET search_path. As a SECURITY DEFINER function it then ran with
-- the caller's search_path (supabase_auth_admin, which does not include
-- public), so the unqualified INSERT failed to resolve and the blanket
-- EXCEPTION handler swallowed the error. Result: users who signed up
-- 2026-07-02 .. 2026-07-13 got no user_credits row (no free credits).
--
-- Applied directly to production on 2026-07-13, together with a one-off
-- backfill: 5 signup credits inserted for the 10 affected users, and +5 for
-- one purchaser whose row had been created by the Stripe webhook without
-- the signup grant.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_credits (user_id, credits_remaining, total_purchased)
  VALUES (NEW.id, 5, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Backfill (one-off, already executed in production 2026-07-13):
-- INSERT INTO public.user_credits (user_id, credits_remaining, total_purchased)
-- SELECT u.id, 5, 0 FROM auth.users u
-- LEFT JOIN public.user_credits c ON c.user_id = u.id
-- WHERE c.user_id IS NULL;
