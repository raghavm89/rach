-- ── 060_patient_military.sql ─────────────────────────────────────────────────
-- Military (AFMS) patient details, shown only when the org's healthcare
-- sub-category is 'military'. Stored as JSONB so it's flexible and maps cleanly
-- to Dhanvantri fields: { service_number, rank, relation, category, arms_corps,
-- unit, formation, trade, record_office, echs_number, validity_from, validity_to }.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS military JSONB NOT NULL DEFAULT '{}'::jsonb;
