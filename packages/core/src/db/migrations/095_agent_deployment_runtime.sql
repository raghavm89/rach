-- ── 095_agent_deployment_runtime.sql ─────────────────────────────────────────
-- On-prem / BYOC support: a pull-based deployment's runtime agent phones home.
-- It authenticates with a per-deployment RUNTIME TOKEN (hash stored here; the
-- plaintext is shown once at deploy), pulls its AgentSpec, and pushes
-- METADATA-ONLY telemetry (status, counts, latency, runtime version) — never
-- conversation content, so on-prem data never leaves the customer's premises.

ALTER TABLE agent_deployments ADD COLUMN IF NOT EXISTS runtime_token_hash   TEXT;
ALTER TABLE agent_deployments ADD COLUMN IF NOT EXISTS runtime_token_prefix TEXT;
ALTER TABLE agent_deployments ADD COLUMN IF NOT EXISTS last_heartbeat_at     TIMESTAMPTZ;
ALTER TABLE agent_deployments ADD COLUMN IF NOT EXISTS telemetry             JSONB;   -- last metadata snapshot (counts/latency)
ALTER TABLE agent_deployments ADD COLUMN IF NOT EXISTS runtime_version       TEXT;    -- runtime-agent version reported
ALTER TABLE agent_deployments ADD COLUMN IF NOT EXISTS placement             TEXT;    -- onprem | aws | gcp | azure | k8s (recipe only)

-- Look up a deployment by its runtime token hash (phone-home auth).
CREATE INDEX IF NOT EXISTS idx_agent_deployments_runtime_token
  ON agent_deployments (runtime_token_hash);
