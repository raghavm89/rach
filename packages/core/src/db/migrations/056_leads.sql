-- ── 056_leads.sql ────────────────────────────────────────────────────────────
-- Public sales leads from the marketing site's contact / "talk to us" form.
-- No tenant — these are prospects, captured before an org exists. Structured
-- qualification fields (industry, deployment, scale, timeline, …) live in `meta`.

CREATE TABLE IF NOT EXISTS leads (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  company    TEXT,
  source     TEXT DEFAULT 'contact',
  goal       TEXT,
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
