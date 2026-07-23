-- Credit-grant integrity for feedback and profile error reports.
-- Applied directly to production 2026-07-23.
--
-- Both edge functions granted credits as read-then-write: sum what the account
-- had already been given, decide the amount, insert the row, then credit. Two
-- requests fired at the same time both read the same "already granted" total
-- and both paid out, so the lifetime caps (12 for reports, 20 for feedback)
-- could be walked past with a handful of parallel requests.
--
-- Worse, the caps were computed from tables the client could write directly:
-- profile_reports accepted any INSERT and feedback accepted any row with a
-- matching user_id, both including `credits_granted`. Inserting a row with a
-- negative value inflated the remaining headroom, so the cap never bound.
--
-- Both grants now happen inside one transaction that locks the account's
-- credits row, and clients may no longer write the credit columns at all.

-- Report submission: cap check, row insert and credit grant under one lock.
CREATE OR REPLACE FUNCTION public.submit_profile_report(
  p_message text,
  p_author_id text DEFAULT NULL,
  p_author_name text DEFAULT NULL,
  p_reporter_email text DEFAULT NULL,
  p_page_url text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_credits integer DEFAULT 3,
  p_cap integer DEFAULT 12
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted integer := 0;
  v_already integer := 0;
BEGIN
  IF p_user_id IS NOT NULL THEN
    PERFORM 1 FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO user_credits (user_id, credits_remaining, total_purchased)
      VALUES (p_user_id, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;
      PERFORM 1 FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
    END IF;

    -- GREATEST(...,0): a negative row must not raise the headroom.
    SELECT COALESCE(SUM(GREATEST(credits_granted, 0)), 0) INTO v_already
    FROM profile_reports WHERE user_id = p_user_id;

    v_granted := GREATEST(0, LEAST(p_credits, p_cap - v_already));
  END IF;

  INSERT INTO profile_reports (
    author_id, author_name, reporter_email, message, page_url, user_id, credits_granted
  ) VALUES (
    p_author_id, p_author_name, NULLIF(btrim(coalesce(p_reporter_email,'')), ''),
    btrim(p_message), p_page_url, p_user_id, v_granted
  );

  IF v_granted > 0 THEN
    -- credits_remaining only. increment_credits() also bumps total_purchased,
    -- which made feedback-only accounts count as paying customers in the admin
    -- dashboard (5 "purchasing users" against 4 real ones).
    UPDATE user_credits
    SET credits_remaining = credits_remaining + v_granted
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_granted;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_profile_report(text,text,text,text,text,uuid,integer,integer)
  FROM public, anon, authenticated;

-- Feedback submission: same shape, first submission earns more than repeats.
CREATE OR REPLACE FUNCTION public.submit_feedback_with_credits(
  p_user_id uuid,
  p_rating integer DEFAULT NULL,
  p_comment text DEFAULT NULL,
  p_profile_viewed text DEFAULT NULL,
  p_source text DEFAULT 'button',
  p_first_credits integer DEFAULT 5,
  p_subsequent_credits integer DEFAULT 2,
  p_cap integer DEFAULT 20
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted integer := 0;
  v_already integer := 0;
  v_count integer := 0;
  v_earned integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  PERFORM 1 FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO user_credits (user_id, credits_remaining, total_purchased)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    PERFORM 1 FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
  END IF;

  SELECT COALESCE(SUM(GREATEST(credits_granted, 0)), 0), COUNT(*)
  INTO v_already, v_count
  FROM feedback WHERE user_id = p_user_id;

  v_earned := CASE WHEN v_count = 0 THEN p_first_credits ELSE p_subsequent_credits END;
  v_granted := GREATEST(0, LEAST(v_earned, p_cap - v_already));

  INSERT INTO feedback (user_id, rating, comment, credits_granted, profile_viewed, source)
  VALUES (p_user_id, p_rating, p_comment, v_granted, p_profile_viewed, p_source);

  IF v_granted > 0 THEN
    UPDATE user_credits
    SET credits_remaining = credits_remaining + v_granted
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_granted;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_feedback_with_credits(uuid,integer,text,text,text,integer,integer,integer)
  FROM public, anon, authenticated;

-- Clients may not write the credit columns the caps are computed from.
-- Anonymous error reporting still works — it just cannot self-credit.
DROP POLICY IF EXISTS "Anyone can submit a report" ON public.profile_reports;
CREATE POLICY "Public can submit an uncredited report" ON public.profile_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL AND credits_granted = 0);

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
CREATE POLICY "Users can insert own uncredited feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND credits_granted = 0);

-- The admin dashboard reads analytics_events, but RLS had no SELECT policy for
-- it: the panel silently rendered empty rather than reporting an error.
CREATE POLICY "Admin can read analytics_events" ON public.analytics_events
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jonasheller89@gmail.com');
