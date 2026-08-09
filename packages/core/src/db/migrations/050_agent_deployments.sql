-- ── 050_agent_deployments.sql ────────────────────────────────────────────────
-- The run-time side of the build/operate seam: what is CURRENTLY deployed, and
-- where. One row per (tenant_id, agent_key) = the agent's current deployment.
--
-- A deployment references a specific PUBLISHED version (agent_spec_versions), so
-- the running agent is pinned to an immutable spec. Redeploying upserts this row
-- to point at the new version. Contract: docs/RACHDEV_RUNTIME_CONTRACT.md.
--
-- runtime_target mirrors the spec's target: RachBase-managed (push), or on-prem /
-- BYOC (the customer's runtime agent pulls the spec and phones telemetry home).
-- `endpoint` and status timestamps hold METADATA only — never conversation content.

CREATE TABLE IF NOT EXISTS agent_deployments (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  agent_key       TEXT    NOT NULL,
  version         INTEGER NOT NULL,
  runtime_target  JSONB   NOT NULL DEFAULT '{"type":"rachbase"}'::jsonb,
  runtime_handle  TEXT,                                  -- opaque handle from the runtime
  status          TEXT    NOT NULL DEFAULT 'pending',    -- pending | running | stopped | failed
  endpoint        JSONB,                                 -- channel endpoints (metadata) the runtime reports
  last_status_at  TIMESTAMPTZ,
  last_error      TEXT,
  created_by      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, agent_key)
);

DO $$ BEGIN
  ALTER TABLE agent_deployments
    ADD CONSTRAINT agent_deployments_status_chk
    CHECK (status IN ('pending', 'running', 'stopped', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_deployments_tenant
  ON agent_deployments (tenant_id, agent_key);
