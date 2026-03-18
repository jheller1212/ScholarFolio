-- Allow admin user to read all analytics tables
CREATE POLICY "Admin can read request_logs"
  ON request_logs FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'jonashjeller89@gmail.com');

CREATE POLICY "Admin can read all credit_purchases"
  ON credit_purchases FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'jonashjeller89@gmail.com');

CREATE POLICY "Admin can read all user_credits"
  ON user_credits FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'jonashjeller89@gmail.com');
