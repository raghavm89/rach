-- ── 075_integrations.sql ─────────────────────────────────────────────────────
-- ABDM + ECHS integration seam. ABHA linkage lives on the patient; every payer
-- verification (ECHS eligibility, cashless pre-auth) is logged as an immutable
-- check with its provenance (source: stub | echs | abdm) so the trail shows what
-- was verified, when, and against which system — swappable to live APIs later.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS abha_number  TEXT;  -- 14-digit ABHA
ALTER TABLE patients ADD COLUMN IF NOT EXISTS abha_address TEXT;  -- ABHA address (user@sbx)

CREATE TABLE IF NOT EXISTS eligibility_checks (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  claim_id      INTEGER REFERENCES claims(id) ON DELETE SET NULL,
  payer         TEXT    NOT NULL DEFAULT 'ECHS',
  kind          TEXT    NOT NULL DEFAULT 'eligibility',  -- eligibility | preauth
  eligible      BOOLEAN,
  valid_from    DATE,
  valid_to      DATE,
  category      TEXT,
  cashless      BOOLEAN,
  reference_id  TEXT,                                     -- pre-auth / transaction id
  amount        NUMERIC,
  status        TEXT,                                     -- verified | ineligible | approved | pending | rejected
  remarks       TEXT,
  source        TEXT    NOT NULL DEFAULT 'stub',          -- stub | echs | abdm
  raw           JSONB   NOT NULL DEFAULT '{}'::jsonb,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eligibility_patient ON eligibility_checks (tenant_id, patient_id, created_at DESC);
