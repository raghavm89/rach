-- ── 059_opd_visit_fields.sql ─────────────────────────────────────────────────
-- Align "New OPD Visit" with Dhanvantri's Add New OPD Visit form:
--   Patient Type (routine|urgent|schedule), OPD/AME/PME, Referral Hospital,
--   Referred By (doctor name). Department + token already exist on `visits`.

ALTER TABLE visits ADD COLUMN IF NOT EXISTS patient_type      TEXT DEFAULT 'routine'; -- routine | urgent | schedule
ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_type        TEXT DEFAULT 'OPD';     -- OPD | AME | PME
ALTER TABLE visits ADD COLUMN IF NOT EXISTS referral_hospital TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS referred_by       TEXT;
