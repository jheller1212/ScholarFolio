-- Replace decrement_credits with an atomic check-and-decrement that returns success/failure
CREATE OR REPLACE FUNCTION decrement_credits(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE user_credits
  SET credits_remaining = credits_remaining - 1
  WHERE user_id = p_user_id
    AND credits_remaining > 0;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;
