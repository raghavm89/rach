-- ── 063_note_visit.sql ───────────────────────────────────────────────────────
-- Link a Scribe clinical note to the specific OPD visit it documents, so a visit
-- can only be completed once notes exist FOR THAT VISIT (not merely for the
-- patient). Legacy notes keep visit_id NULL and still work as patient-level notes.

ALTER TABLE clinical_notes
  ADD COLUMN IF NOT EXISTS visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_notes_visit ON clinical_notes (visit_id);
