CREATE TABLE profile_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scholar_id text NOT NULL,
  author_name text,
  affiliation text,
  viewed_at timestamptz DEFAULT now()
);
CREATE INDEX idx_profile_views_scholar_id ON profile_views (scholar_id);
CREATE INDEX idx_profile_views_viewed_at ON profile_views (viewed_at);
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert profile_views" ON profile_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read profile_views" ON profile_views FOR SELECT USING (true);
