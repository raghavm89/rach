-- ── 067_patient_consent.sql ──────────────────────────────────────────────────
-- DPDP consent capture: an auditable record of the patient's consent to process
-- their health data for a stated purpose. Append-only history — the latest row
-- per (patient, purpose) is the current standing. Supports DPDP purpose-limitation
-- and provenance (who captured it, how, when).

CREATE TABLE IF NOT EXISTS patient_consents (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  purpose     TEXT    NOT NULL DEFAULT 'treatment',  -- treatment | data_processing | echs_claim | research
  granted     BOOLEAN NOT NULL DEFAULT TRUE,
  method      TEXT    NOT NULL DEFAULT 'verbal',      -- verbal | written | digital
  notes       TEXT,
  captured_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consents_patient ON patient_consents (tenant_id, patient_id, purpose, created_at DESC);
