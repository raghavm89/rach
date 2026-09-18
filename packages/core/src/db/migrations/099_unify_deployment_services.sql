-- 099_unify_deployment_services.sql
-- Option A unification (§8): surface dedicated VM deployments inside the single
-- Project → Service model so the dashboard is one Project→Service surface and a VM
-- is just a placement target. Backfills a per-tenant "Dedicated" project + a default
-- 'production' environment, then mirrors each deployment_services row into `services`
-- with compute_target='dedicated', carrying vm_id / repo / branch / status.
--
-- Idempotent (keyed by legacy_deployment_service_id) and reversible. The Max write
-- path (deployRunner / deployment_services) is UNTOUCHED — this is a read-model
-- backfill; running it again only fills gaps. RachBase-only; harmless in rach_dev_db.

-- Provenance link: which deployment_services row a mirrored service came from. Also
-- the idempotency key for re-runs and the handle for a clean reversal.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS legacy_deployment_service_id INTEGER
    REFERENCES deployment_services(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_services_legacy_ds
  ON services (legacy_deployment_service_id)
  WHERE legacy_deployment_service_id IS NOT NULL;

-- 1) One "Dedicated" project per tenant that has dedicated deployments.
INSERT INTO projects (tenant_id, name, slug)
SELECT DISTINCT ds.tenant_id, 'Dedicated', 'dedicated'
  FROM deployment_services ds
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 2) A default 'production' environment for each such project.
INSERT INTO environments (project_id, name, is_default)
SELECT p.id, 'production', TRUE
  FROM projects p
 WHERE p.slug = 'dedicated'
ON CONFLICT (project_id, name) DO NOTHING;

-- 3) Mirror each deployment_services row into services exactly once. Name is the repo
--    short name plus the legacy id, guaranteeing uniqueness within the project.
INSERT INTO services (
  project_id, name, source_type, repo_full_name, branch,
  compute_target, vm_id, status, created_by, legacy_deployment_service_id
)
SELECT
  p.id,
  -- Never NULL/empty: repo short name → full repo → 'service', always suffixed with the legacy id.
  COALESCE(
    NULLIF(split_part(COALESCE(ds.repo_full_name, ''), '/', 2), ''),
    NULLIF(ds.repo_full_name, ''),
    'service'
  ) || '-ds' || ds.id,
  'github_repo',
  ds.repo_full_name,
  ds.branch,
  'dedicated',
  ds.vm_id,
  CASE ds.status
    WHEN 'connected' THEN 'created'
    WHEN 'deploying' THEN 'deploying'
    WHEN 'deployed'  THEN 'online'
    WHEN 'failed'    THEN 'crashed'
    ELSE 'created'
  END,
  ds.created_by,
  ds.id
FROM deployment_services ds
JOIN projects p ON p.tenant_id = ds.tenant_id AND p.slug = 'dedicated'
WHERE NOT EXISTS (
  SELECT 1 FROM services s WHERE s.legacy_deployment_service_id = ds.id
);

-- Reversal (removes only mirrored rows; the Max source data is untouched):
--   DELETE FROM services WHERE legacy_deployment_service_id IS NOT NULL;
--   DROP INDEX IF EXISTS uq_services_legacy_ds;
--   ALTER TABLE services DROP COLUMN IF EXISTS legacy_deployment_service_id;
--   -- optionally prune now-empty auto 'dedicated' projects/environments:
--   --   DELETE FROM environments e WHERE e.name = 'production'
--   --     AND EXISTS (SELECT 1 FROM projects p WHERE p.id = e.project_id AND p.slug = 'dedicated')
--   --     AND NOT EXISTS (SELECT 1 FROM services s WHERE s.project_id = e.project_id);
--   --   DELETE FROM projects p WHERE p.slug = 'dedicated'
--   --     AND NOT EXISTS (SELECT 1 FROM services s WHERE s.project_id = p.id);
