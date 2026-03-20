/*
  # Fix handle_new_user trigger for reliable email signup

  The previous trigger could fail with a duplicate key error if a user_credits
  row already existed (e.g., re-signup of an unconfirmed email), which caused
  the entire auth.users INSERT to roll back, returning a "Database error" to
  the client.

  Changes:
  1. Rebuild handle_new_user() with ON CONFLICT DO NOTHING + exception handler
  2. Add ensure_user_credits() RPC so the client can self-heal if the row is
     still missing after sign-in (belt-and-suspenders).
*/

-- 1. Fix the trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_credits (user_id, credits_remaining, total_purchased)
  VALUES (NEW.id, 5, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log but do not block user creation
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 2. Client-callable fallback: ensures a credits row exists for the caller
CREATE OR REPLACE FUNCTION ensure_user_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_credits (user_id, credits_remaining, total_purchased)
  VALUES (auth.uid(), 5, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
