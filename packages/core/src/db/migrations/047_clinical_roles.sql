-- ── 043_clinical_roles.sql ───────────────────────────────────────────────────
-- Healthcare workspace roles for the on-prem hospital vertical.
--   doctor        — Scribe workspace (dictate → SOAP → sign-off)
--   reception     — reception intake companion
--   store_manager — pharmacy inventory + shortage alerts (Kiran)
-- (tenant_admin is reused as the hospital admin: Control Tower + audit.)
--
-- Mirrors the enum-extension pattern from 007_tenants.sql.

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'doctor';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'reception';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'store_manager';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
