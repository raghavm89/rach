-- 106_tenant_suspend.sql
-- Tenant suspension (contract §9.10). `suspend_mode` NULL = ACTIVE; otherwise one of the
-- three approved modes. Any non-null mode blocks product mutations (deploy/update/delete);
-- WORKLOADS_STOPPED / SECURITY_ISOLATED additionally disable routing/runtime at the site.
-- Suspension NEVER deletes data — resume reconstructs runtime from retained desired state.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspend_mode TEXT;
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_suspend_mode_chk
    CHECK (suspend_mode IS NULL OR suspend_mode IN ('MUTATIONS_BLOCKED', 'WORKLOADS_STOPPED', 'SECURITY_ISOLATED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reversal:
--   ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_suspend_mode_chk;
--   ALTER TABLE tenants DROP COLUMN IF EXISTS suspend_mode;
