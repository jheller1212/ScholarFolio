/*
  # Add user credits and request logging

  1. New Tables
    - `user_credits`: Tracks search credits per user
      - `user_id` (uuid, PK, references auth.users)
      - `credits_remaining` (int, default 5 for free tier)
      - `total_purchased` (int, lifetime purchased credits)
      - `created_at` / `updated_at`
    - `request_logs`: Logs every search request
      - `id` (bigint, auto-increment)
      - `user_id` (uuid, nullable for anonymous)
      - `author_id` (text)
      - `source` (text)
      - `ip` / `origin` / `user_agent`
      - `created_at`
    - `credit_purchases`: Records Stripe purchases
      - `id` (uuid, PK)
      - `user_id` (uuid, references auth.users)
      - `stripe_session_id` (text)
      - `pack` (text)
      - `credits` (int)
      - `amount_cents` (int)
      - `created_at`

  2. Security
    - RLS enabled on all tables
    - Users can only read their own credits/purchases
    - Service role has full access for edge functions
*/

-- User credits table
CREATE TABLE IF NOT EXISTS user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining int NOT NULL DEFAULT 5,
  total_purchased int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credits"
  ON user_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_credits"
  ON user_credits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-create credits row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_credits (user_id, credits_remaining, total_purchased)
  VALUES (NEW.id, 5, 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Request logs table
CREATE TABLE IF NOT EXISTS request_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_id text,
  source text,
  ip text,
  origin text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on request_logs"
  ON request_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Credit purchases table
CREATE TABLE IF NOT EXISTS credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  pack text NOT NULL,
  credits int NOT NULL,
  amount_cents int NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own purchases"
  ON credit_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on credit_purchases"
  ON credit_purchases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update timestamp trigger for user_credits
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
