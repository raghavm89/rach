-- 102_revert_vm_unification.sql
-- REVERSES migration 099 (deployment_services → services unification). Decision changed:
-- VMs are NOT surfaced as Project → Service rows for any tenant. Dedicated VMs stay in
-- `deployment_services` (their real home) and are shown through the VM/Max surfaces, not
-- as container services under an auto-created "Dedicated" project.
--
-- This removes the mirrored services and the migration-owned "Dedicated" projects, and
-- drops the provenance column. The real VM data (`deployment_services`) is UNTOUCHED.
-- Guarded on the 099 column so it's a clean no-op if 099 never ran. RachBase-only.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'legacy_deployment_service_id'
  ) THEN
    -- 1) Remove the mirrored VM services (their deployments cascade).
    DELETE FROM services WHERE legacy_deployment_service_id IS NOT NULL;

    -- 2) Remove now-empty, MIGRATION-OWNED "Dedicated" projects (created_by IS NULL) +
    --    their environments. A user's own project named "dedicated" (created_by set) or
    --    one that still holds services is left alone.
    DELETE FROM environments e
      USING projects p
     WHERE e.project_id = p.id AND p.slug = 'dedicated' AND p.created_by IS NULL
       AND NOT EXISTS (SELECT 1 FROM services s WHERE s.project_id = p.id);

    DELETE FROM projects p
     WHERE p.slug = 'dedicated' AND p.created_by IS NULL
       AND NOT EXISTS (SELECT 1 FROM services s WHERE s.project_id = p.id);

    -- 3) Drop the provenance column + its unique index (no longer used).
    DROP INDEX IF EXISTS uq_services_legacy_ds;
    ALTER TABLE services DROP COLUMN IF EXISTS legacy_deployment_service_id;
  END IF;
END $$;

-- Reversal: re-run migration 099 to re-backfill (it is idempotent).
