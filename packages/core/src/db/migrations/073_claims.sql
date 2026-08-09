-- ── 073_claims.sql ───────────────────────────────────────────────────────────
-- Rhea (Coding & Revenue): a claim drafted by the agent from a signed clinical
-- note — ICD-10 / CPT codes, charge line items, a computed total, and a denial-
-- risk screen (with reasons) — then reviewed by a coder and submitted. The agent
-- drafts and screens; a human confirms before submission. 'draft' → 'submitted'.

CREATE TABLE IF NOT EXISTS claims (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  note_id        INTEGER REFERENCES clinical_notes(id) ON DELETE SET NULL,
  visit_id       INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  patient_ref    TEXT,
  payer          TEXT    NOT NULL DEFAULT 'ECHS',        -- ECHS | CGHS | ex-serviceman | self | TPA
  codes          JSONB   NOT NULL DEFAULT '[]'::jsonb,   -- [{ system, code, description }]
  charges        JSONB   NOT NULL DEFAULT '[]'::jsonb,   -- [{ code, description, amount }]
  total_amount   NUMERIC NOT NULL DEFAULT 0,
  currency       TEXT    NOT NULL DEFAULT 'INR',
  denial_risk    TEXT    NOT NULL DEFAULT 'low',         -- low | medium | high
  denial_reasons JSONB   NOT NULL DEFAULT '[]'::jsonb,   -- [ string ]
  notes          TEXT,
  status         TEXT    NOT NULL DEFAULT 'draft',       -- draft | submitted | paid | denied
  edited         BOOLEAN NOT NULL DEFAULT FALSE,
  model          TEXT,
  submitted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_tenant_time ON claims (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_status      ON claims (tenant_id, status);
