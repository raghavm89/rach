-- ── 078_prescriptions.sql ────────────────────────────────────────────────────
-- Naina depth: structured e-prescription on a clinical note. Each note carries a
-- list of medication orders (drug/strength/dose/frequency/route/duration), drafted
-- by the agent and edited/signed by the clinician. Drug-interaction checking is
-- computed on demand (deterministic rules), not stored, so it always reflects the
-- current medication list.

ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS medications JSONB NOT NULL DEFAULT '[]'::jsonb;
