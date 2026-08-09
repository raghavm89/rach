-- ── 056_encounters.sql ───────────────────────────────────────────────────────
-- Ava (Reception): a patient intake encounter drafted by the agent from a
-- reception conversation, then confirmed by reception/clinician. Feeds the
-- Scribe flow. 'open' = drafted (needs confirmation) · 'confirmed' = accepted.

CREATE TABLE IF NOT EXISTS encounters (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  patient_ref  TEXT,
  patient_name TEXT,
  reason       TEXT,                                 -- presenting complaint (list preview)
  intake       JSONB   NOT NULL DEFAULT '{}'::jsonb, -- structured intake
  transcript   TEXT,
  source       TEXT    NOT NULL DEFAULT 'text',      -- text | dictation | asr
  status       TEXT    NOT NULL DEFAULT 'open',      -- open | confirmed
  model        TEXT,
  confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounters_tenant ON encounters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(tenant_id, status);
