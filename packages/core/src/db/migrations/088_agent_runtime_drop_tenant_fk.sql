-- ── 088_agent_runtime_drop_tenant_fk.sql ─────────────────────────────────────
-- agent_runtime_instances.tenant_id is an external id owned by RachDev, not a
-- RachBase-local tenant. Drop the FK to tenants for DBs that ran 087 with it —
-- RachBase may not hold the tenant row, so the constraint wrongly blocks deploys.

ALTER TABLE agent_runtime_instances DROP CONSTRAINT IF EXISTS agent_runtime_instances_tenant_id_fkey;
