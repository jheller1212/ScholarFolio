-- Email consent layer (GDPR Art. 7 record + list building).
-- Applied directly to production 2026-07-13.
--
-- Stores explicit opt-ins collected at signup / claim / settings, with the
-- consent timestamp, source, and wording version (the audit record). The
-- unsubscribe_token enables one-click, login-free withdrawal from email links
-- (served by the `unsubscribe` edge function, deployed --no-verify-jwt).

CREATE TABLE public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_opt_in boolean NOT NULL DEFAULT false,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  consent_source text,
  wording_version text,
  unsubscribe_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email prefs" ON public.email_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own email prefs" ON public.email_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own email prefs" ON public.email_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can read all email prefs" ON public.email_preferences
  FOR SELECT USING ((auth.jwt() ->> 'email') = 'jonasheller89@gmail.com');
-- NOTE: no service-role policy — service_role bypasses RLS. A `FOR ALL USING (true)`
-- policy without `TO service_role` defaults to TO public and would expose every row
-- to the anon key (caught in review; the briefly-applied policy was dropped in prod).

CREATE TRIGGER email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
