-- ── 087_agent_runtime.sql ────────────────────────────────────────────────────
-- RachBase-side agent runtime. When RachDev pushes a published agent spec via
-- the internal /internal/agent-runtime/* contract, RachBase records the running
-- instance here (keyed by an opaque `handle` RachDev stores) and appends run
-- logs. This is the managed-hosting home for a deployed agent.

CREATE TABLE IF NOT EXISTS agent_runtime_instances (
  handle      TEXT PRIMARY KEY,
  -- tenant_id is an EXTERNAL reference owned by RachDev (the caller), which has
  -- already authenticated the user. RachBase does not necessarily hold that
  -- tenant row, so this is a plain id with no FK to tenants.
  tenant_id   INTEGER NOT NULL,
  agent_key   TEXT    NOT NULL,
  version     INTEGER NOT NULL,
  spec        JSONB   NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'running',   -- running | stopped
  endpoint    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, agent_key)
);

CREATE TABLE IF NOT EXISTS agent_runtime_logs (
  id          SERIAL PRIMARY KEY,
  handle      TEXT    NOT NULL REFERENCES agent_runtime_instances(handle) ON DELETE CASCADE,
  tenant_id   INTEGER NOT NULL,
  level       TEXT    NOT NULL DEFAULT 'info',      -- info | warn | error
  message     TEXT    NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_runtime_logs_handle ON agent_runtime_logs (handle, created_at DESC);
