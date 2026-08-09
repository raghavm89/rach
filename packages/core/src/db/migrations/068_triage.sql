-- ── 068_triage.sql ───────────────────────────────────────────────────────────
-- Vihaan (Triage & Safety): an acuity assessment drafted by the agent from a
-- patient presentation, then acknowledged/routed by a clinician (human-in-the-
-- loop). The agent recommends; a clinician decides. 'draft' → 'acknowledged'.

CREATE TABLE IF NOT EXISTS triage_assessments (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  patient_ref       TEXT,
  visit_id          INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  presentation      TEXT    NOT NULL,
  vitals            TEXT,
  acuity            TEXT,                               -- critical | urgent | semi-urgent | routine
  acuity_score      INTEGER,                            -- 1 (most acute) … 5 (least)
  red_flags         JSONB   NOT NULL DEFAULT '[]'::jsonb,
  recommended_route TEXT,                               -- ER | ICU | OPD | specialist
  page_on_call      BOOLEAN NOT NULL DEFAULT FALSE,
  rationale         TEXT,
  disposition       TEXT,
  status            TEXT    NOT NULL DEFAULT 'draft',   -- draft | acknowledged
  model             TEXT,
  acknowledged_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triage_tenant_time ON triage_assessments (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triage_status      ON triage_assessments (tenant_id, status);
