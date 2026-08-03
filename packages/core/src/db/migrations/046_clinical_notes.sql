-- ── 046_clinical_notes.sql ───────────────────────────────────────────────────
-- Nora (Scribe): a clinical note drafted by the agent from a visit transcript,
-- reviewed and signed off by a clinician (human-in-the-loop). Draft until signed.

CREATE TABLE IF NOT EXISTS clinical_notes (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- who created the draft
  patient_ref  TEXT,                                              -- free-text patient identifier (POC)
  transcript   TEXT    NOT NULL,
  source       TEXT    NOT NULL DEFAULT 'text',                   -- 'text' | 'dictation' | 'asr'
  soap         JSONB   NOT NULL DEFAULT '{}'::jsonb,              -- { subjective, objective, assessment, plan }
  codes        JSONB   NOT NULL DEFAULT '[]'::jsonb,              -- [{ system, code, description }]
  follow_ups   JSONB   NOT NULL DEFAULT '[]'::jsonb,
  status       TEXT    NOT NULL DEFAULT 'draft',                  -- 'draft' | 'signed'
  model        TEXT,
  signed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  signed_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_tenant ON clinical_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_status ON clinical_notes(tenant_id, status);
