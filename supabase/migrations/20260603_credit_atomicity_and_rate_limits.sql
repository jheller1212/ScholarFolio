-- 1. Atomic credit increment (for refunds and webhook credit adds)
CREATE OR REPLACE FUNCTION increment_credits(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_credits
  SET credits_remaining = credits_remaining + p_amount,
      total_purchased = total_purchased + p_amount
  WHERE user_id = p_user_id;

  -- If no row existed, create one
  IF NOT FOUND THEN
    INSERT INTO user_credits (user_id, credits_remaining, total_purchased)
    VALUES (p_user_id, p_amount, p_amount);
  END IF;
END;
$$;

-- 2. Atomic refund (only increments credits_remaining, not total_purchased)
CREATE OR REPLACE FUNCTION refund_credit(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_credits
  SET credits_remaining = credits_remaining + 1
  WHERE user_id = p_user_id;
END;
$$;

-- 3. Persistent rate limit check using request_logs table
-- Returns true if the request is ALLOWED, false if rate-limited
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip text,
  p_limit integer,
  p_window_seconds integer DEFAULT 3600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*)
  INTO recent_count
  FROM request_logs
  WHERE ip = p_ip
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;

  RETURN recent_count < p_limit;
END;
$$;

-- 4. Anon daily limit check (by IP, 24h window)
CREATE OR REPLACE FUNCTION check_anon_daily_limit(p_ip text, p_limit integer DEFAULT 5)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*)
  INTO recent_count
  FROM request_logs
  WHERE ip = p_ip
    AND user_id IS NULL
    AND created_at > now() - interval '24 hours';

  RETURN recent_count < p_limit;
END;
$$;

-- 5. Search rate limit (separate from profile fetches)
CREATE OR REPLACE FUNCTION check_search_rate_limit(p_ip text, p_limit integer DEFAULT 20)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*)
  INTO recent_count
  FROM request_logs
  WHERE ip = p_ip
    AND source = 'search'
    AND created_at > now() - interval '1 hour';

  RETURN recent_count < p_limit;
END;
$$;

-- 6. Index on request_logs for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_request_logs_ip_created
  ON request_logs (ip, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_logs_ip_source_created
  ON request_logs (ip, source, created_at DESC)
  WHERE source = 'search';
