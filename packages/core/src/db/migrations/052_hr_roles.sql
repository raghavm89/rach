-- ── 052_hr_roles.sql ─────────────────────────────────────────────────────────
-- Human Resources workspace roles for the HR vertical (ported from HR Layers).
--   hr_executive    — talent acquisition; drafts + first-line approvals
--   hr_director     — governance; final approver on offers, JDs, batches
--   project_manager — hiring manager for a requisition; PM interview round
-- (tenant_admin is reused as the HR Org Admin.)
--
-- Mirrors the enum-extension pattern from 007_tenants.sql / 047_clinical_roles.sql.

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_executive';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_director';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project_manager';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
