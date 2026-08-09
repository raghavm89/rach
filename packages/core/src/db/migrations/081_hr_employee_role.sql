-- ── 081_hr_employee_role.sql ────────────────────────────────────────────────
-- Adds the 'employee' workspace role for the HR vertical's self-service portal
-- ("My Space": profile, leave, payslips, letters, Ask HR). Employees are the
-- people the HR staff roles manage; they see only their own records.
--
-- Mirrors the enum-extension pattern from 052_hr_roles.sql.

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
