-- Allow multiple GitHub App installations per tenant (personal account + orgs),
-- so repos across all of them are deployable. Previously UNIQUE(tenant_id) meant
-- a second install silently overwrote the first — its repos vanished. An
-- installation_id is globally unique in GitHub and maps to one tenant, so key on
-- that instead and index tenant_id for the per-tenant lookups.

ALTER TABLE deployment_github_installations
  DROP CONSTRAINT IF EXISTS deployment_github_installations_tenant_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deployment_github_installations_installation_id_key'
  ) THEN
    ALTER TABLE deployment_github_installations
      ADD CONSTRAINT deployment_github_installations_installation_id_key UNIQUE (installation_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dgi_tenant
  ON deployment_github_installations(tenant_id);
