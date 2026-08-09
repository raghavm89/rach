-- ── 061_encounter_visit.sql ──────────────────────────────────────────────────
-- Link an AI-intake encounter (Ava) to the OPD visit it produces on confirm, so
-- a confirmed intake lands in the reception OPD queue like a normal registration.

ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_encounters_visit ON encounters(visit_id);
