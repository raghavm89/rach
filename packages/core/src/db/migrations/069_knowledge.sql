-- ── 069_knowledge.sql ────────────────────────────────────────────────────────
-- Ira (Knowledge): a small library of hospital-approved reference content the
-- agent may answer FROM — and only from. Every answer cites these sources; the
-- agent never diagnoses. Keeping the corpus per-tenant keeps answers grounded in
-- that hospital's own protocols (e.g. AFMS high-altitude guidance).

CREATE TABLE IF NOT EXISTS knowledge_docs (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  citation    TEXT,                                   -- source label or URL shown with answers
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_tenant ON knowledge_docs (tenant_id, updated_at DESC);
